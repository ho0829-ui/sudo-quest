/** kubectl get: 목록 표를 상태에서 계산한다. -l 셀렉터와 --show-labels는 모든 종류에 같은 규칙으로 적용한다. */
import { deploymentPods, podReady, serviceEndpoints } from "../../state/kubernetes/reconcile";
import { effectiveRestarts } from "../../state/kubernetes/runtime";
import type { KubernetesState, KubeService } from "../../state/kubernetes/types";
import { fail, ok, type CommandResult } from "../types";
import { age, labels, notFound, table, type Resource } from "./resources";
import { matches, parseSelector } from "./selector";

export interface GetOptions { wide: boolean; showLabels: boolean; selector?: string }

/** EndpointSlice는 서비스마다 컨트롤러가 만든다. 이름 뒤 다섯 글자는 서비스 이름에서 늘 같게 만든다. */
export function sliceName(service: KubeService): string {
  const hash = [...service.name].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0, 7);
  return `${service.name}-${hash.toString(36).slice(-5).padStart(5, "x")}`;
}

export const sliceLabels = (service: KubeService) => ({
  "endpointslice.kubernetes.io/managed-by": "endpointslice-controller.k8s.io", "kubernetes.io/service-name": service.name,
});

interface Row { name: string; labels: Record<string, string>; cells: string[] }

function rows(cluster: KubernetesState, resource: Resource, wide: boolean, clock: number): { headers: string[]; rows: Row[] } {
  if (resource === "pods") return {
    headers: ["NAME", "READY", "STATUS", "RESTARTS", "AGE", ...(wide ? ["IP", "NODE"] : [])],
    rows: cluster.pods.map(p => ({ name: p.name, labels: p.labels, cells: [
      p.name, `${p.containers.filter(c => c.ready).length}/${p.containers.length}`,
      p.node ? p.containers.find(c => c.reason)?.reason ?? p.phase : p.phase,
      String(p.containers.reduce((sum, c) => sum + effectiveRestarts(c, clock), 0)), age(p.createdAt, clock),
      ...(wide ? [p.ip ?? "<none>", p.node ?? "<none>"] : []),
    ] })),
  };
  if (resource === "deployments") return {
    headers: ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE", ...(wide ? ["CONTAINERS", "IMAGES", "SELECTOR"] : [])],
    rows: cluster.deployments.map(d => {
      const pods = deploymentPods(cluster, d);
      const ready = pods.filter(podReady).length;
      return { name: d.name, labels: d.template.labels, cells: [d.name, `${ready}/${d.replicas}`, String(pods.length), String(ready), age(d.createdAt, clock),
        ...(wide ? [d.template.containers.map(c => c.name).join(","), d.template.containers.map(c => c.image).join(","), labels(d.template.labels)] : [])] };
    }),
  };
  if (resource === "services") return {
    headers: ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE", ...(wide ? ["SELECTOR"] : [])],
    rows: cluster.services.map(s => ({ name: s.name, labels: {}, cells: [s.name, "ClusterIP", s.clusterIP, "<none>", `${s.port}/TCP`, age(s.createdAt, clock), ...(wide ? [labels(s.selector)] : [])] })),
  };
  if (resource === "endpoints") return {
    headers: ["NAME", "ENDPOINTS", "AGE"],
    rows: cluster.services.map(s => ({ name: s.name, labels: {}, cells: [s.name, serviceEndpoints(cluster, s).join(",") || "<none>", age(s.createdAt, clock)] })),
  };
  if (resource === "endpointslices") return {
    headers: ["NAME", "ADDRESSTYPE", "PORTS", "ENDPOINTS", "AGE"],
    // 고른 파드가 없으면 포트·주소가 모두 비어 <unset>으로 보인다.
    rows: cluster.services.map(s => {
      const addresses = serviceEndpoints(cluster, s).map(e => e.split(":")[0]);
      return { name: sliceName(s), labels: sliceLabels(s), cells: [sliceName(s), "IPv4", addresses.length ? String(s.targetPort) : "<unset>", addresses.join(",") || "<unset>", age(s.createdAt, clock)] };
    }),
  };
  if (resource === "nodes") return {
    headers: ["NAME", "STATUS", "ROLES", "AGE", ...(wide ? ["INTERNAL-IP"] : [])],
    rows: cluster.nodes.map(n => ({ name: n.name, labels: { "kubernetes.io/hostname": n.name }, cells: [n.name, n.ready ? "Ready" : "NotReady", "<none>", age(n.createdAt, clock), ...(wide ? [n.ip] : [])] })),
  };
  return {
    headers: ["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"],
    rows: cluster.events.map(e => ({ name: e.name, labels: {}, cells: [age(e.time, clock), e.type, e.reason, `pod/${e.pod}`, e.message] })),
  };
}

export function getResources(cluster: KubernetesState, resource: Resource, name: string | undefined, options: GetOptions, clock: number): CommandResult {
  const requirements = options.selector === undefined ? [] : parseSelector(options.selector);
  if (typeof requirements === "string") return fail(requirements);
  const { headers, rows: all } = rows(cluster, resource, options.wide, clock);
  if (name && !all.some(row => row.name === name)) return fail(notFound(resource, name));
  const shown = all.filter(row => (!name || row.name === name) && matches(row.labels, requirements));
  if (!shown.length) return ok("No resources found in default namespace.");
  const withLabels = options.showLabels && resource !== "events";
  return ok(table(withLabels ? [...headers, "LABELS"] : headers, shown.map(row => withLabels ? [...row.cells, labels(row.labels)] : row.cells)));
}
