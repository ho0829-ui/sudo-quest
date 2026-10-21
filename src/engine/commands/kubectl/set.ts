/** kubectl set image | env | resources. 인자를 모두 검사한 뒤에만 바꾼다(일부만 적용되는 일이 없게). */
import { changeTemplate } from "../../state/kubernetes/history";
import { reconcileKubernetes } from "../../state/kubernetes/reconcile";
import { formatMemory, parseMemory } from "../../state/kubernetes/runtime";
import type { ContainerSpec, KubeDeployment, KubernetesState, PodTemplate, ResourceList } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { parseFlags } from "./flags";
import { deploymentName, notFound } from "./resources";

type Found = { deployment: KubeDeployment } | { error: CommandResult };

function findDeployment(cluster: KubernetesState, target: string | undefined, syntax: string): Found {
  const name = deploymentName(target);
  if (!name) return { error: fail(`error: required syntax: ${syntax}`) };
  const deployment = cluster.deployments.find(d => d.name === name);
  return deployment ? { deployment } : { error: fail(notFound("deployments.apps", name)) };
}

/** -c로 고른 컨테이너들. 없으면 전부. */
function pickContainers(template: PodTemplate, container: string | undefined): ContainerSpec[] | string {
  if (!container) return template.containers;
  const found = template.containers.filter(c => c.name === container);
  return found.length ? found : `error: unable to find container named "${container}"`;
}

function apply(cluster: KubernetesState, deployment: KubeDeployment, clock: number, mutate: (template: PodTemplate) => void) {
  // 직접 바꾼 변경은 change-cause 주석이 없으므로 이력에 <none>으로 남는다(실제 kubectl과 같다).
  if (changeTemplate(deployment, "<none>", mutate)) reconcileKubernetes(cluster, clock);
}

export function setImage(cluster: KubernetesState, args: string[], clock: number): CommandResult {
  const found = findDeployment(cluster, args[0], "kubectl set image deployment/NAME CONTAINER=IMAGE");
  if ("error" in found) return found.error;
  const { deployment } = found;
  if (args.length < 2) return fail("error: required syntax: kubectl set image deployment/NAME CONTAINER=IMAGE");
  const updates = new Map<string, string>();
  for (const assignment of args.slice(1)) {
    const match = /^([^=]+)=([^=\s]+)$/.exec(assignment);
    if (!match) return fail(`error: invalid image update: ${assignment}`);
    const [, container, image] = match;
    if (!deployment.template.containers.some(c => c.name === container)) return fail(`error: unable to find container named "${container}"`);
    if (updates.has(container)) return fail(`error: duplicate image update for container "${container}"`);
    updates.set(container, image);
  }
  // 레지스트리에 없는 이미지도 API 갱신은 성공한다. 실제 풀 실패는 Pod/Events에서 관찰한다.
  apply(cluster, deployment, clock, t => t.containers.forEach(c => { c.image = updates.get(c.name) ?? c.image; }));
  return ok(`deployment.apps/${deployment.name} image updated`);
}

const ENV_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function setEnv(cluster: KubernetesState, tokens: string[], clock: number): CommandResult {
  const parsed = parseFlags(tokens, { values: { c: "container", containers: "container" }, switches: { list: "list" } });
  if (!parsed.ok) return fail(parsed.error);
  const found = findDeployment(cluster, parsed.args[0], "kubectl set env deployment/NAME KEY=VALUE ...");
  if ("error" in found) return found.error;
  const { deployment } = found;
  const containers = pickContainers(deployment.template, parsed.values.container);
  if (typeof containers === "string") return fail(containers);
  if (parsed.switches.has("list")) {
    return ok(containers.map(c => [`# Deployment ${deployment.name}, container ${c.name}`,
      ...Object.entries(c.env ?? {}).map(([k, v]) => `${k}=${v}`)].join("\n")).join("\n"));
  }
  const changes = parsed.args.slice(1);
  if (!changes.length) return fail("error: at least one environment change is required");
  const sets: [string, string][] = [];
  const removes: string[] = [];
  for (const change of changes) {
    const assign = /^([^=]+)=(.*)$/.exec(change);
    const name = assign ? assign[1] : change.endsWith("-") ? change.slice(0, -1) : "";
    if (!ENV_NAME.test(name)) return fail(`error: invalid env: ${change}`);
    if (assign) sets.push([name, assign[2]]); else removes.push(name);
  }
  const chosen = new Set(containers.map(c => c.name));
  apply(cluster, deployment, clock, t => t.containers.filter(c => chosen.has(c.name)).forEach(c => {
    const env = { ...c.env };
    for (const [name, value] of sets) env[name] = value;
    for (const name of removes) delete env[name];
    c.env = env;
  }));
  return ok(`deployment.apps/${deployment.name} env updated`);
}

/** --limits=memory=512Mi,cpu=500m 형식. 메모리는 MiB로 바꾸고 cpu는 값만 보관한다. */
function parseResourceList(value: string | undefined): ResourceList | string | undefined {
  if (value === undefined) return undefined;
  const list: ResourceList = {};
  for (const pair of value.split(",")) {
    const [name, quantity] = pair.split("=");
    if (name === "memory") {
      const mi = quantity === undefined ? undefined : parseMemory(quantity);
      if (mi === undefined) return `error: quantities must match the regular expression '^([+-]?[0-9.]+)([eEinumkKMGTP]*[-+]?[0-9]*)$'`;
      list.memoryMi = mi;
    } else if (name === "cpu" && quantity && /^[0-9.]+m?$/.test(quantity)) list.cpu = quantity;
    else return `error: invalid resource specification: ${pair}`;
  }
  return list;
}

export function setResources(cluster: KubernetesState, tokens: string[], clock: number): CommandResult {
  const parsed = parseFlags(tokens, { values: { c: "container", containers: "container", limits: "limits", requests: "requests" } });
  if (!parsed.ok) return fail(parsed.error);
  const found = findDeployment(cluster, parsed.args[0], "kubectl set resources deployment/NAME [-c=CONTAINER] --limits=memory=512Mi");
  if ("error" in found) return found.error;
  const { deployment } = found;
  if (parsed.args.length > 1) return fail(`error: unexpected argument: ${parsed.args[1]}`);
  const limits = parseResourceList(parsed.values.limits);
  const requests = parseResourceList(parsed.values.requests);
  if (typeof limits === "string") return fail(limits);
  if (typeof requests === "string") return fail(requests);
  if (!limits && !requests) return fail("error: you must specify an update to requests or limits (in the form of --requests/--limits)");
  const containers = pickContainers(deployment.template, parsed.values.container);
  if (typeof containers === "string") return fail(containers);
  for (const [index, c] of deployment.template.containers.entries()) {
    if (!containers.includes(c)) continue;
    const request = requests?.memoryMi ?? c.resources?.requests?.memoryMi;
    const limit = limits?.memoryMi ?? c.resources?.limits?.memoryMi;
    // API 서버 검증: request가 limit보다 클 수 없다. 이때는 아무것도 바꾸지 않는다.
    if (request !== undefined && limit !== undefined && request > limit) {
      return fail(`The Deployment "${deployment.name}" is invalid: spec.template.spec.containers[${index}].resources.requests: Invalid value: "${formatMemory(request)}": must be less than or equal to memory limit of ${formatMemory(limit)}`);
    }
  }
  const chosen = new Set(containers.map(c => c.name));
  apply(cluster, deployment, clock, t => t.containers.filter(c => chosen.has(c.name)).forEach(c => {
    c.resources = {
      ...(requests || c.resources?.requests ? { requests: { ...c.resources?.requests, ...requests } } : {}),
      ...(limits || c.resources?.limits ? { limits: { ...c.resources?.limits, ...limits } } : {}),
    };
  }));
  return ok(`deployment.apps/${deployment.name} resource requirements updated`);
}
