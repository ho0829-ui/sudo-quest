import { withCommands } from "../engine/commands";
import type { Scenario } from "../engine/scenario/types";
import { writeFile } from "../engine/state/fs";
import { addDeployment } from "../engine/state/kubernetes/history";
import { deploymentPods, podReady, reconcileKubernetes, serviceEndpoints } from "../engine/state/kubernetes/reconcile";
import type { SystemState } from "../engine/state/types";

const OLD = "registry.example.com/shop/payment:4.1.3";
const NEW = "registry.example.com/shop/payment-api:4.2.0";
const NEW_LABELS = { "app.kubernetes.io/name": "payment-api", "app.kubernetes.io/part-of": "shop" };

/** 판정: payment 서비스의 엔드포인트가 payment-api의 Ready 파드 전부이고, 그 포트가 앱이 듣는 8080이다. */
function paymentServed(state: SystemState): boolean {
  const cluster = state.kubernetes;
  const service = cluster?.services.find(s => s.name === "payment");
  const deployment = cluster?.deployments.find(d => d.name === "payment-api");
  if (!cluster || !service || !deployment) return false;
  const ready = deploymentPods(cluster, deployment).filter(podReady).map(p => `${p.ip}:${service.targetPort}`).sort();
  const endpoints = serviceEndpoints(cluster, service).sort();
  return ready.length > 0 && service.targetPort === 8080 && JSON.stringify(endpoints) === JSON.stringify(ready);
}

export const kubernetesServiceSelector: Scenario = {
  id: "kubernetes-service-selector",
  title: "결제 서버에 연결할 수 없대요",
  category: "kubernetes",
  difficulty: 2,
  ticket: [
    "11시쯤부터 주문 결제 단계에서 \"결제 서버에 연결할 수 없습니다\"가 뜹니다.",
    "결제팀은 오전에 배포를 마쳤고 새 파드는 모두 Ready라고 합니다. 주문 서비스는 클러스터 안에서 http://payment 로 결제를 호출합니다.",
    "default 네임스페이스이고, 작업 기록은 운영 호스트의 /home/ubuntu에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "Service는 소유 관계가 아니라 라벨 셀렉터로 파드를 고른다는 것을 엔드포인트로 확인한다",
    "describe svc의 Selector와 get pods --show-labels·-l로 셀렉터 불일치를 증명한다",
    "셀렉터를 고치고(set selector) 엔드포인트가 새 파드를 가리키는지 검증한다",
  ],
  host: "kubernetes-admin",
  commands: withCommands("kubectl"),
  faults: [(state) => {
    const cluster = state.kubernetes!;
    const installed = state.clock - 30 * 86_400_000;
    const migrated = state.clock - 900_000;
    cluster.images[OLD] = { ports: [8080], paths: ["/healthz"], log: { boot: ["INFO  payment 4.1.3 starting"], ready: ["INFO  listening on :8080"] } };
    cluster.images[NEW] = { ports: [8080], paths: ["/healthz"],
      log: { boot: ["INFO  payment-api 4.2.0 starting", "INFO  pg gateway client configured"], ready: ["INFO  listening on :8080"] } };
    addDeployment(cluster, { name: "payment", replicas: 2, labels: { app: "payment" }, createdAt: installed,
      containers: [{ name: "payment", image: OLD, readinessProbe: { path: "/healthz", port: 8080 } }],
      changeCause: "release payment:4.1.3", service: { clusterIP: "10.96.0.70", port: 80, targetPort: 8080 } });
    reconcileKubernetes(cluster, installed);
    // 장애: 라벨 표준화로 새 Deployment(payment-api)를 만들고 옛 것을 지웠다. Service payment는 손대지 않았다.
    // Deployment 셀렉터는 바꿀 수 없어 이름을 바꿔 새로 만드는 일이 흔하다(그래서 rollout undo로 되돌릴 대상도 없다).
    addDeployment(cluster, { name: "payment-api", replicas: 2, labels: NEW_LABELS, createdAt: migrated,
      containers: [{ name: "api", image: NEW, readinessProbe: { path: "/healthz", port: 8080 } }],
      changeCause: "release payment-api:4.2.0 (labels: app.kubernetes.io/*)" });
    cluster.deployments = cluster.deployments.filter(d => d.name !== "payment");
    reconcileKubernetes(cluster, migrated);
    writeFile(state.fs, "/home/ubuntu/releases.txt", { mtime: migrated, content: [
      "RELEASE LOG — default namespace",
      "09:00 shop-web: registry.example.com/shop/web:1.4.2 — smoke test passed",
      "10:58 payment-api: 4.2.0 새 Deployment로 배포 (라벨 표준화 PR #88, app.kubernetes.io/*) — pods 2/2 Ready",
      "11:00 payment: 옛 Deployment 삭제 (상세: /home/ubuntu/payment-api/MIGRATION.md)",
    ].join("\n") });
    writeFile(state.fs, "/home/ubuntu/payment-api/MIGRATION.md", { mtime: migrated, content: [
      "# payment → payment-api 이전 체크리스트 (PR #88)", "",
      "- [x] 이미지 이름 payment-api로 변경",
      "- [x] 라벨을 app.kubernetes.io/name, app.kubernetes.io/part-of로 표준화",
      "- [x] payment-api Deployment 배포, 파드 Ready 확인",
      "- [x] 옛 payment Deployment 삭제",
      "- [ ] 다른 팀 매니페스트의 라벨 참조 정리 (다음 주)",
    ].join("\n") });
  }],
  rootCause: {
    answerId: "selector-mismatch",
    choices: [
      { id: "selector-mismatch", label: "Service payment의 셀렉터(app=payment)가 새 파드 라벨(app.kubernetes.io/name=payment-api)과 맞지 않아 엔드포인트가 비었다" },
      { id: "readiness", label: "새 파드의 readiness probe가 실패해 트래픽에서 빠졌다",
        whyWrong: "`kubectl get pods`에서 payment-api 파드는 1/1 Ready입니다. Ready인데도 엔드포인트가 비었다면 서비스가 그 파드를 고르지 못하는 것입니다." },
      { id: "target-port", label: "서비스 targetPort가 앱 포트와 달라 연결이 거부된다",
        whyWrong: "targetPort는 8080으로 앱 포트와 같습니다. 포트만 틀렸다면 `kubectl get endpoints payment`에 IP:포트는 보입니다. 여기서는 <none>입니다." },
      { id: "dns", label: "클러스터 DNS가 payment 이름을 찾지 못한다",
        whyWrong: "`kubectl get svc payment`에 ClusterIP가 있어 이름은 그 주소로 풀립니다. 문제는 그 주소 뒤에 보낼 파드가 없다는 것입니다." },
      { id: "network-policy", label: "NetworkPolicy가 주문 서비스에서 결제 파드로 가는 트래픽을 막는다",
        whyWrong: "NetworkPolicy가 막아도 엔드포인트 목록은 그대로 있습니다. 엔드포인트가 <none>인 것은 셀렉터에 맞는 Ready 파드가 없다는 뜻입니다." },
    ],
  },
  hints: [
    "결제 파드는 건강하다고 해요. 그렇다면 http://payment 로 들어온 요청이 그 파드까지 가는 길에는 무엇이 있을까요?",
    "`kubectl get endpoints payment`, `kubectl describe svc payment`의 Selector, `kubectl get pods --show-labels`를 비교해 보세요.",
    "서비스는 app=payment를 찾는데 새 파드에는 그 라벨이 없네요. `kubectl set selector svc payment app.kubernetes.io/name=payment-api`로 셀렉터를 고치세요.",
  ],
  resolution: paymentServed,
  solutionPath: [
    "kubectl get pods",
    "kubectl get endpoints payment",
    "kubectl describe svc payment",
    "kubectl get pods --show-labels",
    "kubectl get pods -l app=payment",
    "cat /home/ubuntu/releases.txt",
    "kubectl set selector svc payment app.kubernetes.io/name=payment-api",
    "kubectl get endpoints payment",
  ],
  postmortem: {
    whatHappened: "11:00 결제 앱을 라벨 표준화와 함께 payment-api라는 새 Deployment로 옮기고 옛 payment Deployment를 지웠습니다. Service payment의 셀렉터는 여전히 app=payment라 고를 파드가 없어 엔드포인트가 비었고, http://payment 로 오는 결제 호출이 모두 실패했습니다.",
    whyItHappened: "Service는 Deployment를 가리키지 않고 라벨로 파드를 고릅니다. 이전 체크리스트에 \"라벨을 참조하는 Service\"가 빠져 있었고, 새 파드가 Ready인 것만 확인한 뒤 옛 Deployment를 지웠습니다.",
    howToFix: "`kubectl set selector svc payment app.kubernetes.io/name=payment-api`로 셀렉터를 새 라벨로 바꾸고 `kubectl get endpoints payment`로 두 파드 주소가 보이는지 확인합니다. patch로 고칠 때는 셀렉터가 키 단위로 합쳐지므로 옛 키를 \"app\": null로 지워야 합니다.",
    howToPrevent: [
      "1) 라벨을 바꿀 때는 그 라벨을 쓰는 Service·NetworkPolicy·모니터링 셀렉터를 함께 검색해 같은 변경에서 고칩니다.",
      "2) 옛 Deployment를 지우기 전에 Service 엔드포인트가 새 파드를 가리키는지 확인하는 단계를 체크리스트에 넣습니다.",
      "3) 엔드포인트 0개인 Service에 경보를 겁니다.",
    ].join("\n"),
    realWorldNote: "Deployment의 셀렉터(spec.selector)는 만든 뒤 바꿀 수 없어서, 라벨 체계를 바꾸면 새 이름의 Deployment를 만드는 경우가 많습니다. 이때 Service 셀렉터를 놓치면 파드는 모두 Ready인데 서비스만 비는 이 장애가 납니다. 이 실습은 EndpointSlice를 서비스마다 하나로 단순화했고, 클러스터 안에서 ClusterIP로 직접 요청하는 동작은 재현하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Kubernetes — Debug Services: Does the Service have any EndpointSlices?", url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/#does-the-service-have-any-endpointslices" },
    { kind: "official-doc", title: "Kubernetes — Debug Services: Is the Service defined correctly?", url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/#is-the-service-defined-correctly" },
    { kind: "official-doc", title: "kubectl set selector", url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_set/kubectl_set_selector/" },
  ],
};
