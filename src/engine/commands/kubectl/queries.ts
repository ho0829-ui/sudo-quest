import { deploymentPods, podReady, serviceEndpoints } from "../../state/kubernetes/reconcile";
import type { KubernetesState } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { age, labels, notFound, table, type Resource } from "./resources";

export function getResources(cluster: KubernetesState, resource: Resource, name: string | undefined, wide: boolean, clock: number): CommandResult {
  const source = resource === "endpoints" ? cluster.services : cluster[resource];
  if (name && !source.some(item => item.name === name)) return fail(notFound(resource, name));
  const selected = (value: { name: string }) => !name || value.name === name;
  const show = (headers: string[], rows: string[][]) => ok(rows.length ? table(headers, rows) : "No resources found in default namespace.");
  if (resource === "pods") return show(
    ["NAME", "READY", "STATUS", "RESTARTS", "AGE", ...(wide ? ["IP", "NODE"] : [])],
    cluster.pods.filter(selected).map(p => [
      p.name, `${p.containers.filter(c => c.ready).length}/${p.containers.length}`,
      p.node ? p.containers.find(c => c.reason)?.reason ?? p.phase : p.phase,
      String(p.containers.reduce((sum, c) => sum + c.restartCount, 0)), age(p.createdAt, clock),
      ...(wide ? [p.ip ?? "<none>", p.node ?? "<none>"] : []),
    ]),
  );
  if (resource === "deployments") return show(
    ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])],
    cluster.deployments.filter(selected).map(d => {
      const pods = deploymentPods(cluster, d);
      const ready = pods.filter(podReady).length;
      return [d.name, `${ready}/${d.replicas}`, String(pods.length), String(ready), age(d.createdAt, clock),
        ...(wide ? [d.template.containers.map(c => c.name).join(","), d.template.containers.map(c => c.image).join(","), labels(d.template.labels)] : [])];
    }),
  );
  if (resource === "services") return show(
    ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE", ...(wide ? ["SELECTOR"] : [])],
    cluster.services.filter(selected).map(s => [s.name, "ClusterIP", s.clusterIP, "<none>", `${s.port}/TCP`, age(s.createdAt, clock), ...(wide ? [labels(s.selector)] : [])]),
  );
  if (resource === "endpoints") return show(["NAME", "ENDPOINTS", "AGE"],
    cluster.services.filter(selected).map(s => [s.name, serviceEndpoints(cluster, s).join(",") || "<none>", age(s.createdAt, clock)]));
  if (resource === "nodes") return show(["NAME", "STATUS", "ROLES", "AGE", ...(wide ? ["INTERNAL-IP"] : [])],
    cluster.nodes.filter(selected).map(n => [n.name, n.ready ? "Ready" : "NotReady", "<none>", age(n.createdAt, clock), ...(wide ? [n.ip] : [])]));
  return show(["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"],
    cluster.events.filter(selected).map(e => [age(e.time, clock), e.type, e.reason, `pod/${e.pod}`, e.message]));
}

export function describeResources(cluster: KubernetesState, resource: Resource, name: string | undefined, clock: number): CommandResult {
  if (resource !== "pods" && resource !== "deployments") return fail(`error: describe is not supported for resource type "${resource}"`);
  const selected = (value: { name: string }) => !name || value.name === name;
  if (name && !cluster[resource].some(selected)) return fail(notFound(resource, name));
  if (resource === "deployments") return ok(cluster.deployments.filter(selected).map(d => [
    `Name:           ${d.name}`, "Namespace:      default", `Selector:       ${labels(d.template.labels)}`,
    `Replicas:       ${d.replicas} desired | ${deploymentPods(cluster, d).filter(podReady).length} available`,
    `StrategyType:   ${d.strategy}`, `Revision:       ${d.revision}`, "Pod Template:",
    `  Labels:       ${labels(d.template.labels)}`, ...d.template.containers.flatMap(c => [
      `  ${c.name}:`, `    Image:      ${c.image}`,
      ...(c.readinessProbe ? [`    Readiness:  http-get http://:${c.readinessProbe.port}${c.readinessProbe.path}`] : []),
    ]),
  ].join("\n")).join("\n\n") || "No resources found in default namespace.");
  return ok(cluster.pods.filter(selected).map(p => [
    `Name:         ${p.name}`, "Namespace:    default", `Node:         ${p.node ?? "<none>"}`,
    `Labels:       ${labels(p.labels)}`, `Status:       ${p.phase}`, `IP:           ${p.ip ?? "<none>"}`,
    `Controlled By: ReplicaSet/${p.name.slice(0, p.name.lastIndexOf("-"))}`, "Containers:",
    ...p.containers.flatMap(c => [
      `  ${c.name}:`, `    Image:          ${c.image}`, `    State:          ${c.state}`,
      ...(c.reason ? [`      Reason:       ${c.reason}`] : []),
      `    Ready:          ${c.ready ? "True" : "False"}`, `    Restart Count:  ${c.restartCount}`,
    ]),
    "Events:", table(["TYPE", "REASON", "AGE", "MESSAGE"], cluster.events.filter(e => e.pod === p.name)
      .map(e => [e.type, e.reason, age(e.time, clock), e.message])),
  ].join("\n")).join("\n\n") || "No resources found in default namespace.");
}
