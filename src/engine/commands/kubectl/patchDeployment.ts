/**
 * kubectl patch deployment: strategic merge(컨테이너는 이름으로 합침)와 merge(목록 통째 교체) 중
 * replicas·템플릿 라벨·컨테이너 image·readinessProbe만 반영한다. 셀렉터와 맞지 않는 라벨은 실제처럼 거절한다.
 */
import { changeTemplate, selectorOf } from "../../state/kubernetes/history";
import type { ContainerSpec, KubeDeployment, PodTemplate } from "../../state/kubernetes/types";
import { matches } from "./selector";

type Json = Record<string, unknown>;
export type PatchOutcome = { changed: boolean } | { error: string };

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const PROBE_TIMING = ["initialDelaySeconds", "periodSeconds", "timeoutSeconds", "failureThreshold", "successThreshold"];

/** 지원하지 않는 필드 경로를 찾는다. 실제 API 서버는 스키마에 없는 필드가 든 patch를 거절한다. */
export function unknownField(value: unknown, allowed: Record<string, unknown>, path: string): string | null {
  if (!isObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (!Object.hasOwn(allowed, key)) return `${path}.${key}`;
    const rule = allowed[key];
    if (rule === true) continue;
    const items = Array.isArray(child) ? child : [child];
    for (const item of items) {
      const found = unknownField(item, rule as Record<string, unknown>, `${path}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

const PROBE = { httpGet: { path: true, port: true, scheme: true }, ...Object.fromEntries(PROBE_TIMING.map(k => [k, true])) };
export const DEPLOYMENT_FIELDS = {
  spec: { replicas: true, template: { metadata: { labels: true }, spec: { containers: { name: true, image: true, readinessProbe: PROBE } } } },
};

function applyProbe(container: ContainerSpec, probe: unknown, where: string): string | null {
  if (probe === null) { delete container.readinessProbe; return null; }
  if (!isObject(probe)) return null;
  const http = probe.httpGet;
  if (!isObject(http)) return container.readinessProbe ? null : `${where}.readinessProbe: Required value: must specify a handler type`;
  const port = http.port === undefined ? container.readinessProbe?.port : Number(http.port);
  if (port === undefined || !Number.isInteger(port) || port < 1 || port > 65535) {
    return `${where}.readinessProbe.httpGet.port: Invalid value: ${JSON.stringify(http.port ?? null)}: must contain a valid port number`;
  }
  const path = typeof http.path === "string" ? http.path : container.readinessProbe?.path ?? "/";
  container.readinessProbe = { path, port };
  return null;
}

function applyContainer(target: ContainerSpec, patch: Json, where: string): string | null {
  if (typeof patch.image === "string") target.image = patch.image;
  return "readinessProbe" in patch ? applyProbe(target, patch.readinessProbe, where) : null;
}

function applyContainers(template: PodTemplate, list: unknown, strategic: boolean): string | null {
  if (!Array.isArray(list)) return "spec.template.spec.containers: Invalid value: must be a list";
  // merge patch는 목록을 통째로 바꾼다. strategic merge는 name이 같은 컨테이너만 고친다.
  const next = strategic ? template.containers : [];
  for (const [index, item] of list.entries()) {
    const where = `spec.template.spec.containers[${index}]`;
    if (!isObject(item) || typeof item.name !== "string") return `${where}.name: Required value`;
    let target = next.find(c => c.name === item.name);
    if (!target) {
      if (typeof item.image !== "string") return `${where}.image: Required value`;
      target = { name: item.name, image: item.image };
      next.push(target);
    }
    const error = applyContainer(target, item, where);
    if (error) return error;
  }
  template.containers = next;
  return null;
}

export function patchDeployment(deployment: KubeDeployment, patch: Json, strategic: boolean): PatchOutcome {
  const invalid = (detail: string) => ({ error: `The Deployment "${deployment.name}" is invalid: ${detail}` });
  const spec = isObject(patch.spec) ? patch.spec : {};
  const replicas = spec.replicas;
  if (replicas !== undefined && (!Number.isInteger(replicas) || (replicas as number) < 0)) {
    return invalid(`spec.replicas: Invalid value: ${JSON.stringify(replicas)}: must be greater than or equal to 0`);
  }
  const template = isObject(spec.template) ? spec.template : {};
  const next = structuredClone(deployment.template);
  const labels = isObject(template.metadata) ? template.metadata.labels : undefined;
  if (isObject(labels)) {
    for (const [key, value] of Object.entries(labels)) {
      if (value === null) delete next.labels[key];
      else next.labels[key] = String(value);
    }
  }
  const podSpec = isObject(template.spec) ? template.spec : {};
  if ("containers" in podSpec) {
    const error = applyContainers(next, podSpec.containers, strategic);
    if (error) return invalid(error);
  }
  // Deployment 셀렉터는 바꿀 수 없으므로, 템플릿 라벨이 셀렉터를 벗어나면 API 서버가 거절한다.
  const selector = selectorOf(deployment);
  if (!matches(next.labels, Object.entries(selector).map(([key, value]) => ({ key, op: "=" as const, value })))) {
    const shown = Object.entries(next.labels).map(([k, v]) => `"${k}":"${v}"`).join(", ");
    return invalid(`spec.template.metadata.labels: Invalid value: map[string]string{${shown}}: \`selector\` does not match template \`labels\``);
  }
  // 라벨이 처음 바뀌기 전에 셀렉터를 굳혀 둔다. 이후 라벨을 더 고쳐도 셀렉터는 그대로다.
  if (JSON.stringify(next.labels) !== JSON.stringify(deployment.template.labels)) deployment.selector ??= { ...selector };
  let changed = changeTemplate(deployment, "<none>", template => { template.labels = next.labels; template.containers = next.containers; });
  if (typeof replicas === "number" && replicas !== deployment.replicas) {
    deployment.replicas = replicas;
    changed = true;
  }
  return { changed };
}
