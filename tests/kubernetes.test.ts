import { describe, expect, it } from "vitest";
import { kubernetesAdmin } from "../src/engine/state/hosts/kubernetesAdmin";
import { deploymentReady, podReady, reconcileKubernetes, serviceEndpoints } from "../src/engine/state/kubernetes/reconcile";

describe("가상 Kubernetes 상태 계산", () => {
  it("정상 프리셋의 모든 Deployment는 Ready이며 서비스별 엔드포인트를 계산한다", () => {
    const cluster = kubernetesAdmin().kubernetes!;
    expect(cluster.deployments.every(d => deploymentReady(cluster, d))).toBe(true);
    expect(serviceEndpoints(cluster, cluster.services[0])).toEqual(["10.244.0.10:8080", "10.244.0.11:8080"]);
    expect(serviceEndpoints(cluster, cluster.services[1])).toEqual(["10.244.1.10:80"]);
  });

  it("이미지 참조를 바꾸면 새 revision의 파드·이벤트·엔드포인트가 함께 바뀐다", () => {
    const { kubernetes: cluster, clock } = kubernetesAdmin();
    const deployment = cluster!.deployments[0];
    const oldNames = cluster!.pods.filter(p => p.deployment === deployment.name).map(p => p.name);
    deployment.template.containers[0].image = "missing:1";
    deployment.revision++;
    reconcileKubernetes(cluster!, clock);
    expect(cluster!.pods).toHaveLength(3);
    expect(cluster!.pods.some(p => oldNames.includes(p.name))).toBe(false);
    expect(cluster!.pods.filter(p => p.deployment === deployment.name).every(p => p.phase === "Pending")).toBe(true);
    expect(cluster!.events.some(e => e.message.includes('"missing:1"'))).toBe(true);
    expect(serviceEndpoints(cluster!, cluster!.services[0])).toEqual([]);
    expect(serviceEndpoints(cluster!, cluster!.services[1])).toHaveLength(1);
  });

  it("같은 상태를 다시 계산해도 파드 나이·이벤트 수가 변하지 않는다", () => {
    const state = kubernetesAdmin();
    const before = structuredClone(state.kubernetes);
    reconcileKubernetes(state.kubernetes!, state.clock + 600_000);
    expect(state.kubernetes).toEqual(before);
  });

  it("엔드포인트는 모든 selector 조건과 Ready를 만족해야 하며, 빈 selector는 자동 선택하지 않는다", () => {
    const cluster = kubernetesAdmin().kubernetes!;
    const service = cluster.services[0];
    service.selector.tier = "frontend";
    expect(serviceEndpoints(cluster, service)).toEqual([]);
    cluster.pods[0].labels.tier = "frontend";
    expect(serviceEndpoints(cluster, service)).toHaveLength(1);
    cluster.pods[0].containers[0].ready = false;
    expect(serviceEndpoints(cluster, service)).toEqual([]);
    service.selector = {};
    expect(serviceEndpoints(cluster, service)).toEqual([]);
  });

  it("이미지를 받았어도 readiness probe 실패면 엔드포인트에서 빠진다", () => {
    const state = kubernetesAdmin();
    const cluster = state.kubernetes!;
    cluster.deployments[0].template.containers[0].readinessProbe!.path = "/missing";
    reconcileKubernetes(cluster, state.clock);
    expect(cluster.pods[0].phase).toBe("Running");
    expect(podReady(cluster.pods[0])).toBe(false);
    expect(serviceEndpoints(cluster, cluster.services[0])).toEqual([]);
    expect(cluster.events.some(e => e.reason === "Unhealthy")).toBe(true);
  });

  it("Ready 노드가 없으면 스케줄링 실패와 비어 있는 엔드포인트를 계산한다", () => {
    const state = kubernetesAdmin();
    const cluster = state.kubernetes!;
    cluster.nodes.forEach(n => { n.ready = false; });
    reconcileKubernetes(cluster, state.clock);
    expect(cluster.pods.every(p => !p.node && !p.ip && p.phase === "Pending")).toBe(true);
    expect(cluster.events.some(e => e.reason === "FailedScheduling")).toBe(true);
    expect(cluster.services.every(s => serviceEndpoints(cluster, s).length === 0)).toBe(true);
  });

  it("여러 컨테이너 중 하나라도 풀 실패면 파드는 Ready가 아니다", () => {
    const state = kubernetesAdmin();
    state.kubernetes!.deployments[0].template.containers.push({ name: "sidecar", image: "missing:1" });
    reconcileKubernetes(state.kubernetes!, state.clock);
    expect(state.kubernetes!.pods[0].containers.map(c => c.ready)).toEqual([true, false]);
    expect(podReady(state.kubernetes!.pods[0])).toBe(false);
  });
});
