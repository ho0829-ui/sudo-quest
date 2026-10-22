/**
 * Service를 바꾸는 명령: kubectl set selector(셀렉터 통째 교체)와 kubectl patch svc(selector·ports 합치기).
 * 엔드포인트는 저장하지 않고 셀렉터와 Ready 파드에서 계산하므로, 셀렉터만 바꾸면 바로 따라 바뀐다.
 */
import type { KubernetesState, KubeService } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { parseFlags } from "../flags";
import { notFound, resourceOf } from "./resources";
import { parseAssignments } from "./selector";
import type { PatchOutcome } from "./patchDeployment";

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

export const SERVICE_FIELDS = { spec: { selector: true, ports: { port: true, targetPort: true, protocol: true, name: true } } };

/** TYPE NAME 또는 TYPE/NAME 모양의 대상. */
export function target(args: string[]): { kind: string; name: string; rest: string[] } | null {
  if (args[0]?.includes("/")) {
    const [kind, name] = args[0].split("/", 2);
    return name ? { kind, name, rest: args.slice(1) } : null;
  }
  return args.length >= 2 ? { kind: args[0], name: args[1], rest: args.slice(2) } : null;
}

export function setSelector(cluster: KubernetesState, tokens: string[]): CommandResult {
  const parsed = parseFlags(tokens, {});
  if (!parsed.ok) return fail(parsed.error);
  const found = target(parsed.args);
  if (!found || !found.rest.length) return fail("error: one resource and selector expressions are required. See 'kubectl set selector -h' for help and examples");
  const resource = resourceOf(found.kind);
  if (resource === "deployments") {
    // Deployment 셀렉터는 만든 뒤 바꿀 수 없다(apps/v1).
    return fail(`The Deployment "${found.name}" is invalid: spec.selector: Invalid value: "${found.rest.join(",")}": field is immutable`);
  }
  if (resource !== "services") return fail(`error: the server doesn't have a resource type "${found.kind}"`);
  const service = cluster.services.find(s => s.name === found.name);
  if (!service) return fail(notFound("services", found.name));
  const selector = parseAssignments(found.rest);
  if (typeof selector === "string") return fail(selector);
  service.selector = selector;
  return ok(`service/${service.name} selector updated`);
}

/** selector는 키 단위로 합치고 null이면 그 키를 지운다(strategic·merge 둘 다 같다). ports는 port 값이 같은 항목을 고친다. */
export function patchService(service: KubeService, patch: Json, strategic: boolean): PatchOutcome {
  const spec = isObject(patch.spec) ? patch.spec : {};
  const before = JSON.stringify(service);
  if (isObject(spec.selector)) {
    for (const [key, value] of Object.entries(spec.selector)) {
      if (value === null) delete service.selector[key];
      else service.selector[key] = String(value);
    }
  }
  if (Array.isArray(spec.ports)) {
    const items = spec.ports.filter(isObject);
    const item = strategic ? items.find(p => Number(p.port) === service.port) : items[0];
    if (!strategic && items.length && item && item.port === undefined) return { error: `The Service "${service.name}" is invalid: spec.ports[0].port: Required value` };
    if (item) {
      const targetPort = item.targetPort === undefined ? service.targetPort : Number(item.targetPort);
      if (!Number.isInteger(targetPort) || targetPort < 1 || targetPort > 65535) {
        return { error: `The Service "${service.name}" is invalid: spec.ports[0].targetPort: Invalid value: ${JSON.stringify(item.targetPort)}: must be between 1 and 65535, inclusive` };
      }
      if (item.port !== undefined) service.port = Number(item.port);
      service.targetPort = targetPort;
    }
  }
  return { changed: JSON.stringify(service) !== before };
}
