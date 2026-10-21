/** kubectl rollout status | history | undo */
import { undoTo } from "../../state/kubernetes/history";
import { deploymentPods, deploymentReady, podReady, reconcileKubernetes } from "../../state/kubernetes/reconcile";
import type { KubernetesState } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { parseFlags } from "./flags";
import { deploymentName, notFound, table } from "./resources";

function target(cluster: KubernetesState, args: string[], verb: string) {
  const name = deploymentName(args[0]);
  if (!name || args.length !== 1) return { error: fail(`error: required syntax: kubectl rollout ${verb} deployment/NAME`) };
  const deployment = cluster.deployments.find(d => d.name === name);
  return deployment ? { deployment } : { error: fail(notFound("deployments.apps", name)) };
}

export function rolloutStatus(cluster: KubernetesState, args: string[]): CommandResult {
  const found = target(cluster, args, "status");
  if ("error" in found) return found.error!;
  const { deployment } = found;
  if (deploymentReady(cluster, deployment)) return ok(`deployment "${deployment.name}" successfully rolled out`);
  const ready = deploymentPods(cluster, deployment).filter(podReady).length;
  // 브라우저를 기다리게 하지 않고 현재 결과를 반환한다. 실시간 watch/timeout은 모델링하지 않는다.
  return fail(`Waiting for deployment "${deployment.name}" rollout to finish: ${ready} of ${deployment.replicas} updated replicas are available...\nerror: timed out waiting for the condition`);
}

export function rolloutHistory(cluster: KubernetesState, args: string[]): CommandResult {
  const found = target(cluster, args, "history");
  if ("error" in found) return found.error!;
  const { deployment } = found;
  const rows = [...deployment.history].sort((a, b) => a.revision - b.revision).map(h => [String(h.revision), h.changeCause]);
  return ok(`deployment.apps/${deployment.name}\n${table(["REVISION", "CHANGE-CAUSE"], rows)}`);
}

export function rolloutUndo(cluster: KubernetesState, tokens: string[], clock: number): CommandResult {
  const parsed = parseFlags(tokens, { values: { "to-revision": "to" } });
  if (!parsed.ok) return fail(parsed.error);
  const found = target(cluster, parsed.args, "undo");
  if ("error" in found) return found.error!;
  const { deployment } = found;
  const to = parsed.values.to;
  if (to !== undefined && !/^\d+$/.test(to)) return fail(`error: invalid argument "${to}" for "--to-revision" flag: strconv.ParseInt: parsing "${to}": invalid syntax`);
  const toRevision = to === undefined || Number(to) === 0 ? undefined : Number(to);
  const before = deployment.revision;
  const result = undoTo(deployment, toRevision);
  if (!result.ok) {
    return fail(result.missing ? `error: unable to find specified revision ${result.missing} in history`
      : `error: no rollout history found for deployment "${deployment.name}"`);
  }
  if (deployment.revision === before) return ok(`deployment.apps/${deployment.name} skipped rollback (current template already matches revision ${toRevision})`);
  reconcileKubernetes(cluster, clock);
  return ok(`deployment.apps/${deployment.name} rolled back`);
}
