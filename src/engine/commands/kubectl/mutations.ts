import { deploymentPods, deploymentReady, podReady, reconcileKubernetes } from "../../state/kubernetes/reconcile";
import type { KubernetesState } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { notFound, resourceOf } from "./resources";

export function deploymentName(target: string | undefined): string | undefined {
  const parts = target?.split("/");
  return parts?.length === 2 && resourceOf(parts[0]) === "deployments" && parts[1] ? parts[1] : undefined;
}

export function setImage(cluster: KubernetesState, args: string[], clock: number): CommandResult {
  const name = deploymentName(args[0]);
  if (!name || args.length < 2) return fail("error: required syntax: kubectl set image deployment/NAME CONTAINER=IMAGE");
  const deployment = cluster.deployments.find(d => d.name === name);
  if (!deployment) return fail(notFound("deployments.apps", name));
  const updates = new Map<string, string>();
  for (const assignment of args.slice(1)) {
    const match = /^([^=]+)=([^=\s]+)$/.exec(assignment);
    if (!match) return fail(`error: invalid image update: ${assignment}`);
    const [, container, image] = match;
    if (!deployment.template.containers.some(c => c.name === container)) return fail(`error: unable to find container named "${container}"`);
    if (updates.has(container)) return fail(`error: duplicate image update for container "${container}"`);
    updates.set(container, image);
  }
  // 인자를 모두 검증한 뒤 변경한다. 여러 컨테이너 중 하나의 오타가 부분 변경으로 이어지면 안 된다.
  const changed = deployment.template.containers.some(c => updates.has(c.name) && updates.get(c.name) !== c.image);
  if (changed) {
    for (const container of deployment.template.containers) container.image = updates.get(container.name) ?? container.image;
    deployment.revision++;
    reconcileKubernetes(cluster, clock);
  }
  // 레지스트리에 없는 이미지도 API 갱신은 성공한다. 실제 풀 실패는 Pod/Events에서 관찰한다.
  return ok(`deployment.apps/${name} image updated`);
}

export function rolloutStatus(cluster: KubernetesState, args: string[]): CommandResult {
  const name = deploymentName(args[0]);
  if (!name || args.length !== 1) return fail("error: required syntax: kubectl rollout status deployment/NAME");
  const deployment = cluster.deployments.find(d => d.name === name);
  if (!deployment) return fail(notFound("deployments.apps", name));
  if (deploymentReady(cluster, deployment)) return ok(`deployment "${name}" successfully rolled out`);
  const ready = deploymentPods(cluster, deployment).filter(podReady).length;
  // 브라우저를 기다리게 하지 않고 현재 결과를 반환한다. 실시간 watch/timeout은 모델링하지 않는다.
  return fail(`Waiting for deployment "${name}" rollout to finish: ${ready} of ${deployment.replicas} updated replicas are available...\nerror: timed out waiting for the condition`);
}
