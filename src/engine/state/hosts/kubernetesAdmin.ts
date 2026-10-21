import { ubuntuWeb } from "./ubuntuWeb";
import { writeFile } from "../fs";
import { reconcileKubernetes } from "../kubernetes/reconcile";
import type { SystemState } from "../types";

export function kubernetesAdmin(): SystemState {
  const state = ubuntuWeb();
  state.hostname = "k8s-admin";
  writeFile(state.fs, "/etc/hostname", { content: "k8s-admin\n", mtime: state.clock });
  writeFile(state.fs, "/etc/hosts", { content: "127.0.0.1 localhost\n127.0.1.1 k8s-admin\n", mtime: state.clock });
  // 운영 기록도 가상 파일이다. 정답 전용 목록이 아니라 배포 이력에서 이전 버전을 찾게 한다.
  writeFile(state.fs, "/home/ubuntu/releases.txt", {
    content: [
      "RELEASE LOG — default namespace",
      "09:00 shop-web: registry.example.com/shop/web:1.4.2 — smoke test passed",
      "09:02 status-page: registry.example.com/status:1.0.0 — smoke test passed",
      "Runbook: check Deployment, Pod events and Service endpoints after each release.",
    ].join("\n"), mtime: state.clock - 900_000,
  });
  const createdAt = state.clock - 900_000;
  state.kubernetes = {
    nodes: [
      { name: "worker-01", ready: true, ip: "10.0.2.11", createdAt },
      { name: "worker-02", ready: true, ip: "10.0.2.12", createdAt },
    ],
    images: {
      "registry.example.com/shop/web:1.4.2": { ports: [8080], paths: ["/", "/health"] },
      "registry.example.com/status:1.0.0": { ports: [80], paths: ["/"] },
    },
    deployments: [
      {
        name: "shop-web", replicas: 2, revision: 1, createdAt, strategy: "Recreate",
        template: { labels: { app: "shop-web" }, containers: [{
          name: "web", image: "registry.example.com/shop/web:1.4.2", readinessProbe: { path: "/health", port: 8080 },
        }] },
      },
      {
        name: "status-page", replicas: 1, revision: 1, createdAt, strategy: "Recreate",
        template: { labels: { app: "status-page" }, containers: [{ name: "status", image: "registry.example.com/status:1.0.0" }] },
      },
    ],
    services: [
      { name: "shop-web", selector: { app: "shop-web" }, clusterIP: "10.96.0.10", port: 80, targetPort: 8080, createdAt },
      { name: "status-page", selector: { app: "status-page" }, clusterIP: "10.96.0.20", port: 80, targetPort: 80, createdAt },
    ],
    pods: [], events: [],
  };
  reconcileKubernetes(state.kubernetes, createdAt);
  return state;
}
