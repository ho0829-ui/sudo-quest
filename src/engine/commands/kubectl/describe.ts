/** kubectl describe pod | deploy | svc. 실제 kubectl의 들여쓰기·항목 순서를 따르고, 값은 모두 상태에서 계산한다. */
import { deploymentPods, podReady, serviceEndpoints } from "../../state/kubernetes/reconcile";
import { effectiveRestarts, formatMemory } from "../../state/kubernetes/runtime";
import type { ContainerSpec, KubeDeployment, KubePod, KubernetesState, KubeService } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { age, labels, notFound, table, type Resource } from "./resources";

/** describe의 Readiness·Limits·Requests·Environment 줄 */
function specLines(c: ContainerSpec, indent: string, pad: string): string[] {
  const list = (title: string, values: { memoryMi?: number; cpu?: string } | undefined) => values && (values.memoryMi !== undefined || values.cpu)
    ? [`${indent}${title}:`, ...(values.cpu ? [`${indent}  cpu:     ${values.cpu}`] : []),
       ...(values.memoryMi !== undefined ? [`${indent}  memory:  ${formatMemory(values.memoryMi)}`] : [])] : [];
  const env = Object.entries(c.env ?? {});
  const probe = c.readinessProbe;
  return [
    ...list("Limits", c.resources?.limits), ...list("Requests", c.resources?.requests),
    // 주기·실패 기준은 kubelet 기본값이다(가상 클러스터는 즉시 판정한다).
    ...(probe ? [`${indent}Readiness:${pad}http-get http://:${probe.port}${probe.path} delay=0s timeout=1s period=10s #success=1 #failure=3`] : []),
    `${indent}Environment:${env.length ? "" : "  <none>"}`, ...env.map(([k, v]) => `${indent}  ${k}:  ${v}`),
  ];
}

function describeDeployment(cluster: KubernetesState, d: KubeDeployment): string {
  return [
    `Name:           ${d.name}`, "Namespace:      default", `Selector:       ${labels(d.selector ?? d.template.labels)}`,
    `Replicas:       ${d.replicas} desired | ${deploymentPods(cluster, d).filter(podReady).length} available`,
    `StrategyType:   ${d.strategy}`, `Revision:       ${d.revision}`, "Pod Template:",
    `  Labels:       ${labels(d.template.labels)}`,
    ...d.template.containers.flatMap(c => [`  ${c.name}:`, `    Image:      ${c.image}`, ...specLines(c, "    ", "  ")]),
  ].join("\n");
}

function describePod(cluster: KubernetesState, p: KubePod, clock: number): string {
  const ready = podReady(p);
  return [
    `Name:         ${p.name}`, "Namespace:    default", `Node:         ${p.node ?? "<none>"}`,
    `Labels:       ${labels(p.labels)}`, `Status:       ${p.phase}`, `IP:           ${p.ip ?? "<none>"}`,
    `Controlled By: ReplicaSet/${p.name.slice(0, p.name.lastIndexOf("-"))}`, "Containers:",
    ...p.containers.flatMap(c => [
      `  ${c.name}:`, `    Image:          ${c.image}`, `    State:          ${c.state}`,
      ...(c.reason ? [`      Reason:       ${c.reason}`] : []),
      // 직전 실행이 어떻게 끝났는지. OOMKilled·종료 코드 137은 여기서만 보인다(get pods는 CrashLoopBackOff).
      ...(c.lastState ? [`    Last State:     Terminated`, `      Reason:       ${c.lastState.reason}`,
        `      Exit Code:    ${c.lastState.exitCode}`] : []),
      `    Ready:          ${c.ready ? "True" : "False"}`, `    Restart Count:  ${effectiveRestarts(c, clock)}`,
      ...specLines(c, "    ", "      "),
    ]),
    // Ready 조건이 False인 파드는 서비스 엔드포인트에서 빠진다.
    "Conditions:", "  Type              Status", `  Initialized       ${p.node ? "True" : "False"}`,
    `  Ready             ${ready ? "True" : "False"}`, `  ContainersReady   ${ready ? "True" : "False"}`, `  PodScheduled      ${p.node ? "True" : "False"}`,
    "Events:", table(["TYPE", "REASON", "AGE", "MESSAGE"], cluster.events.filter(e => e.pod === p.name)
      .map(e => [e.type, e.reason, age(e.time, clock), e.message])),
  ].join("\n");
}

function describeService(cluster: KubernetesState, s: KubeService): string {
  const endpoints = serviceEndpoints(cluster, s);
  return [
    `Name:                     ${s.name}`, "Namespace:                default", "Labels:                   <none>", "Annotations:              <none>",
    `Selector:                 ${labels(s.selector)}`, "Type:                     ClusterIP", "IP Family Policy:         SingleStack",
    "IP Families:              IPv4", `IP:                       ${s.clusterIP}`, `IPs:                      ${s.clusterIP}`,
    `Port:                     <unset>  ${s.port}/TCP`, `TargetPort:               ${s.targetPort}/TCP`,
    `Endpoints:                ${endpoints.join(",") || "<none>"}`, "Session Affinity:         None",
    "Internal Traffic Policy:  Cluster", "Events:                   <none>",
  ].join("\n");
}

export function describeResources(cluster: KubernetesState, resource: Resource, name: string | undefined, clock: number): CommandResult {
  if (resource !== "pods" && resource !== "deployments" && resource !== "services") return fail(`error: describe is not supported for resource type "${resource}"`);
  const items: { name: string }[] = cluster[resource];
  if (name && !items.some(item => item.name === name)) return fail(notFound(resource, name));
  const pick = <T extends { name: string }>(list: T[]) => list.filter(item => !name || item.name === name);
  const text = resource === "pods" ? pick(cluster.pods).map(p => describePod(cluster, p, clock))
    : resource === "deployments" ? pick(cluster.deployments).map(d => describeDeployment(cluster, d))
    : pick(cluster.services).map(s => describeService(cluster, s));
  return ok(text.join("\n\n") || "No resources found in default namespace.");
}
