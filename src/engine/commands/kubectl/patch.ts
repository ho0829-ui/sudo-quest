/**
 * kubectl patch (TYPE NAME | TYPE/NAME) -p '<JSON>' [--type strategic|merge].
 * JSON은 브라우저 내장 JSON.parse로 읽는다. 지원하지 않는 필드가 있으면 아무것도 바꾸지 않고 거절한다.
 */
import { reconcileKubernetes } from "../../state/kubernetes/reconcile";
import type { KubernetesState } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { parseFlags } from "../flags";
import { notFound, resourceOf } from "./resources";
import { DEPLOYMENT_FIELDS, patchDeployment, unknownField } from "./patchDeployment";
import { patchService, SERVICE_FIELDS, target } from "./service";

const USAGE = "error: must specify -p to patch";

export function patch(cluster: KubernetesState, tokens: string[], clock: number): CommandResult {
  const parsed = parseFlags(tokens, { values: { p: "patch", patch: "patch", type: "type" } });
  if (!parsed.ok) return fail(parsed.error);
  const found = target(parsed.args);
  if (!found || found.rest.length) return fail("error: you must specify the type of resource to patch and its name, e.g. kubectl patch deployment/NAME -p '{...}'");
  const text = parsed.values.patch;
  if (text === undefined) return fail(USAGE);
  const type = parsed.values.type ?? "strategic";
  if (type === "json") return fail("error: --type=json patches are not supported in this virtual cluster; use strategic or merge");
  if (type !== "strategic" && type !== "merge") return fail(`error: --type must be one of [json merge strategic], not "${type}"`);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(`error: unable to parse "${text}": yaml: did not find expected node content`);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return fail(`error: unable to parse "${text}": json: cannot unmarshal into a patch object`);
  const json = body as Record<string, unknown>;
  const resource = resourceOf(found.kind);
  const strategic = type === "strategic";

  if (resource === "deployments") {
    const deployment = cluster.deployments.find(d => d.name === found.name);
    if (!deployment) return fail(notFound("deployments.apps", found.name));
    const unknown = unknownField(json, DEPLOYMENT_FIELDS, "");
    if (unknown) return fail(`Error from server: failed to create typed patch object (default/${found.name}; apps/v1, Kind=Deployment): ${unknown}: field not declared in schema`);
    const result = patchDeployment(deployment, json, strategic);
    if ("error" in result) return fail(result.error);
    if (result.changed) reconcileKubernetes(cluster, clock);
    return ok(`deployment.apps/${deployment.name} patched${result.changed ? "" : " (no change)"}`);
  }
  if (resource === "services") {
    const service = cluster.services.find(s => s.name === found.name);
    if (!service) return fail(notFound("services", found.name));
    const unknown = unknownField(json, SERVICE_FIELDS, "");
    if (unknown) return fail(`Error from server: failed to create typed patch object (default/${found.name}; /v1, Kind=Service): ${unknown}: field not declared in schema`);
    const result = patchService(service, json, strategic);
    if ("error" in result) return fail(result.error);
    return ok(`service/${service.name} patched${result.changed ? "" : " (no change)"}`);
  }
  if (!resource) return fail(`error: the server doesn't have a resource type "${found.kind}"`);
  return fail(`error: patching ${resource} is not supported in this virtual cluster; patch a deployment or service`);
}
