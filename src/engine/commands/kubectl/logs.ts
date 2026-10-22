/**
 * kubectl logs POD | deploy/NAME [-c CONTAINER] [-p|--previous] [--tail=N]
 * 로그 내용은 이미지 정보와 컨테이너 설정으로 계산한다(runtime.runLog). 시나리오에 출력 문장을 적지 않는다.
 */
import { deploymentPods } from "../../state/kubernetes/reconcile";
import { runLog } from "../../state/kubernetes/runtime";
import type { KubePod, KubernetesState } from "../../state/kubernetes/types";
import { fail, type CommandResult } from "../types";
import { parseFlags } from "../flags";
import { notFound, resourceOf } from "./resources";

const USAGE = "error: expected 'logs [-f] [-p] (POD | TYPE/NAME) [-c CONTAINER]'.\nPOD or TYPE/NAME is a required argument for the logs command";

/** 파드 하나를 고른다. deploy/NAME이면 실제 kubectl처럼 첫 파드를 쓰고 그 사실을 stderr로 알린다. */
function pickPod(cluster: KubernetesState, target: string): { pod: KubePod; note: string } | { error: string } {
  const [kind, name] = target.includes("/") ? target.split("/", 2) : ["pod", target];
  const resource = resourceOf(kind);
  if (resource === "pods") {
    const pod = cluster.pods.find(p => p.name === name);
    return pod ? { pod, note: "" } : { error: notFound("pods", name) };
  }
  if (resource === "deployments") {
    const deployment = cluster.deployments.find(d => d.name === name);
    if (!deployment) return { error: notFound("deployments.apps", name) };
    const pods = deploymentPods(cluster, deployment);
    if (!pods.length) return { error: `error: timed out waiting for the condition` };
    return { pod: pods[0], note: pods.length > 1 ? `Found ${pods.length} pods, using pod/${pods[0].name}` : "" };
  }
  return { error: `error: cannot get the logs from ${kind}: selector for ${kind} not implemented` };
}

export function logs(cluster: KubernetesState, tokens: string[]): CommandResult {
  const parsed = parseFlags(tokens, { values: { c: "container", container: "container", tail: "tail" }, switches: { p: "previous", previous: "previous" } });
  if (!parsed.ok) return fail(parsed.error);
  if (parsed.args.length !== 1) return fail(USAGE);
  const tail = parsed.values.tail;
  if (tail !== undefined && !/^-?\d+$/.test(tail)) return fail(`error: invalid argument "${tail}" for "--tail" flag: strconv.ParseInt: parsing "${tail}": invalid syntax`);
  const picked = pickPod(cluster, parsed.args[0]);
  if ("error" in picked) return fail(picked.error);
  const { pod } = picked;
  const notes = picked.note ? [picked.note] : [];
  let container = pod.containers.find(c => c.name === parsed.values.container);
  if (parsed.values.container && !container) return fail(`error: container ${parsed.values.container} is not valid for pod ${pod.name}`);
  if (!container) {
    container = pod.containers[0];
    if (pod.containers.length > 1) notes.push(`Defaulted container "${container.name}" out of: ${pod.containers.map(c => c.name).join(", ")}`);
  }
  const previous = parsed.switches.has("previous");
  const crashed = container.reason === "CrashLoopBackOff";
  // 아직 한 번도 시작하지 못한 컨테이너에는 로그가 없다.
  if (container.reason === "ImagePullBackOff" || container.reason === "ContainerCreating") {
    const why = container.reason === "ImagePullBackOff" ? "trying and failing to pull image" : "ContainerCreating";
    return fail(`Error from server (BadRequest): container "${container.name}" in pod "${pod.name}" is waiting to start: ${why}`);
  }
  if (previous && !crashed) {
    return fail(`Error from server (BadRequest): previous terminated container "${container.name}" in pod "${pod.name}" not found`);
  }
  const image = cluster.images[container.image];
  // 반복 종료 중이면 지금 컨테이너는 다음 재시작을 기다리는 중이라, 마지막 실행의 로그가 그대로 보인다.
  let lines = image ? runLog(container, image) : [];
  if (tail !== undefined && Number(tail) >= 0) lines = Number(tail) === 0 ? [] : lines.slice(-Number(tail));
  // deploy/NAME로 고른 파드·기본 컨테이너 안내는 실제 kubectl처럼 stderr로 낸다(종료 코드 0).
  return { stdout: lines.join("\n"), stderr: notes.join("\n"), exitCode: 0 };
}
