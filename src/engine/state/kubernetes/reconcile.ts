import { readiness } from "./probe";
import { outcome } from "./runtime";
import type { KubeContainer, KubeDeployment, KubePod, KubernetesState, KubeService } from "./types";

export const podReady = (pod: KubePod): boolean =>
  pod.phase === "Running" && pod.containers.length > 0 && pod.containers.every(c => c.ready);

const podIp = (deploymentIndex: number, i: number) => `10.244.${deploymentIndex}.${i + 10}`;

export function deploymentPods(cluster: KubernetesState, deployment: KubeDeployment): KubePod[] {
  return cluster.pods.filter(p => p.deployment === deployment.name && p.revision === deployment.revision);
}

export function deploymentReady(cluster: KubernetesState, deployment: KubeDeployment): boolean {
  const pods = deploymentPods(cluster, deployment);
  return pods.length === deployment.replicas && pods.every(podReady);
}

export function serviceEndpoints(cluster: KubernetesState, service: KubeService): string[] {
  // Service는 소유 Deployment가 아니라 라벨로 고른다. 다른 Deployment의 Ready Pod도 대상이다.
  const selector = Object.entries(service.selector);
  if (!selector.length) return [];
  return cluster.pods.filter(p => podReady(p) && p.ip && selector.every(([key, value]) => p.labels[key] === value))
    .map(p => `${p.ip}:${service.targetPort}`);
}

/**
 * 템플릿 변경 후의 안정된 상태까지 즉시 진행한다. 실시간 재시도·스케줄러·롤링 업데이트는 범위 밖이다.
 * 같은 revision은 이름/생성 시각을 유지하고, 이전 revision의 Pod는 Recreate 전략에 따라 교체한다.
 */
export function reconcileKubernetes(cluster: KubernetesState, clock: number): void {
  const previous = cluster.pods;
  const nodes = cluster.nodes.filter(n => n.ready);
  const pods: KubePod[] = [];
  for (const [deploymentIndex, deployment] of cluster.deployments.entries()) {
    for (let i = 0; i < deployment.replicas; i++) {
      const name = `${deployment.name}-${deployment.revision.toString(16).padStart(10, "0")}-${String(i + 1).padStart(5, "0")}`;
      const old = previous.find(p => p.name === name);
      const node = nodes[i % nodes.length];
      const containers: KubeContainer[] = deployment.template.containers.map(spec => {
        const image = Object.hasOwn(cluster.images, spec.image) ? cluster.images[spec.image] : undefined;
        const before = old?.containers.find(c => c.name === spec.name);
        const result = outcome(spec, image);
        const base = { ...structuredClone(spec), restartCount: before?.restartCount ?? 0 };
        if (!node || result.kind === "pull") {
          return { ...base, state: "Waiting", reason: node ? "ImagePullBackOff" : "ContainerCreating", ready: false };
        }
        if (result.kind === "crash") {
          // 시작은 했지만 곧 끝나는 컨테이너. 같은 파드면 반복 종료가 시작된 시각을 그대로 둔다.
          return { ...base, state: "Waiting", reason: "CrashLoopBackOff", ready: false, lastState: result.last,
            crashingSince: before?.crashingSince ?? clock };
        }
        return { ...base, state: "Running", ready: readiness(spec, image!, podIp(deploymentIndex, i)).ok };
      });
      const pod: KubePod = {
        name, deployment: deployment.name, revision: deployment.revision,
        labels: { ...deployment.template.labels }, createdAt: old?.createdAt ?? clock,
        node: node?.name, ip: node ? podIp(deploymentIndex, i) : undefined,
        // 반복 종료 중인 컨테이너가 있어도 파드는 노드에서 실행 중(Running)이다. 이미지를 못 받으면 Pending.
        phase: containers.every(c => c.state === "Running" || c.reason === "CrashLoopBackOff") ? "Running" : "Pending", containers,
      };
      pods.push(pod);
      const event = (reason: string, message: string, warning = false, container = "") => {
        const id = `${pod.name}.${container}.${reason}`;
        // 조회나 동일 이미지 재설정만으로 같은 이벤트가 끝없이 쌓이지 않게 한다.
        if (!cluster.events.some(e => e.name === id)) cluster.events.push({
          name: id, pod: pod.name, time: clock, type: warning ? "Warning" : "Normal", reason, message,
        });
      };
      if (!node) event("FailedScheduling", "No ready nodes available", true);
      else {
        event("Scheduled", `Successfully assigned default/${name} to ${node.name}`);
        for (const container of containers) {
          if (container.reason === "ImagePullBackOff") {
            event("Failed", `Failed to pull image "${container.image}": failed to resolve reference: not found`, true, container.name);
            event("BackOff", `Back-off pulling image "${container.image}"`, true, container.name);
          } else {
            event("Pulled", `Successfully pulled image "${container.image}"`, false, container.name);
            event("Started", `Started container ${container.name}`, false, container.name);
            if (container.reason === "CrashLoopBackOff") {
              event("BackOff", `Back-off restarting failed container ${container.name} in pod ${pod.name}_default`, true, container.name);
            } else if (!container.ready) {
              const result = readiness(container, cluster.images[container.image], pod.ip);
              if (!result.ok) event("Unhealthy", result.message, true, container.name);
            }
          }
        }
      }
    }
  }
  cluster.pods = pods;
  // 장시간 실습에서도 세션 복원 크기를 제한하되, 이전 배포의 진단 이력은 남긴다.
  cluster.events = cluster.events.slice(-100);
}
