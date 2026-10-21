import { withCommands } from "../engine/commands";
import type { Scenario } from "../engine/scenario/types";
import { writeFile } from "../engine/state/fs";
import { addDeployment, changeTemplate } from "../engine/state/kubernetes/history";
import { deploymentReady, reconcileKubernetes, serviceEndpoints } from "../engine/state/kubernetes/reconcile";

const ORDER_OLD = "registry.example.com/shop/order-api:2.2.4";
const ORDER_NEW = "registry.example.com/shop/order-api:2.3.0";
const GATEWAY = "registry.example.com/shop/payment-gateway:1.8.1";

export const kubernetesCrashloop: Scenario = {
  id: "kubernetes-crashloop",
  title: "배포 직후 주문하기가 전부 실패해요",
  category: "kubernetes",
  difficulty: 2,
  ticket: [
    "10:25쯤부터 주문하기 버튼을 누르면 오류가 납니다. 고객 문의가 몰리고 있어요.",
    "모니터링에 order-api 파드 재시작 경고가 계속 올라옵니다. 쇼핑몰 화면(shop-web)과 결제 게이트웨이는 정상으로 보입니다.",
    "default 네임스페이스이고, 배포 기록은 운영 호스트의 /home/ubuntu/releases.txt에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "CrashLoopBackOff가 '시작은 했지만 곧 끝난다'는 뜻임을 이벤트와 Last State로 확인한다",
    "직전 실행 로그(kubectl logs, --previous)에서 종료 원인을 찾는다",
    "rollout history로 무엇이 바뀌었는지 찾고, 롤백과 설정 보충 중 상황에 맞는 복구를 고른다",
  ],
  host: "kubernetes-admin",
  commands: withCommands("kubectl"),
  faults: [(state) => {
    const cluster = state.kubernetes!;
    const installed = state.clock - 1_800_000;
    cluster.images[ORDER_OLD] = { ports: [8080], paths: ["/healthz"], requiredEnv: ["DB_HOST"], memoryMi: 180,
      log: { boot: ["INFO  order-api 2.2.4 starting", "INFO  reading configuration from environment", "INFO  connected to orders-db:5432"],
        ready: ["INFO  listening on :8080"] } };
    cluster.images[ORDER_NEW] = { ports: [8080], paths: ["/healthz"], requiredEnv: ["DB_HOST", "PAYMENT_API_URL"], memoryMi: 190,
      log: { boot: ["INFO  order-api 2.3.0 starting", "INFO  reading configuration from environment"],
        ready: ["INFO  connected to orders-db:5432", "INFO  payment client configured", "INFO  listening on :8080"] } };
    cluster.images[GATEWAY] = { ports: [8080], paths: ["/healthz"], memoryMi: 120,
      log: { boot: ["INFO  payment-gateway 1.8.1 starting"], ready: ["INFO  listening on :8080"] } };
    addDeployment(cluster, { name: "payment-gateway", replicas: 1, labels: { app: "payment-gateway" }, createdAt: installed,
      containers: [{ name: "gateway", image: GATEWAY, readinessProbe: { path: "/healthz", port: 8080 } }],
      changeCause: "release payment-gateway:1.8.1", service: { clusterIP: "10.96.0.40", port: 8080, targetPort: 8080 } });
    addDeployment(cluster, { name: "order-api", replicas: 2, labels: { app: "order-api" }, createdAt: installed,
      containers: [{ name: "order", image: ORDER_OLD, readinessProbe: { path: "/healthz", port: 8080 },
        env: { DB_HOST: "orders-db", DB_PORT: "5432" }, resources: { requests: { memoryMi: 128 }, limits: { memoryMi: 256 } } }],
      changeCause: "release order-api:2.2.4", service: { clusterIP: "10.96.0.30", port: 80, targetPort: 8080 } });
    reconcileKubernetes(cluster, installed);
    // 장애: 새 버전이 요구하는 환경 변수를 매니페스트에 넣지 않고 이미지만 올렸다.
    const order = cluster.deployments.find(d => d.name === "order-api")!;
    changeTemplate(order, "release order-api:2.3.0", template => { template.containers[0].image = ORDER_NEW; });
    reconcileKubernetes(cluster, state.clock - 420_000);
    writeFile(state.fs, "/home/ubuntu/releases.txt", {
      mtime: state.clock - 420_000, content: [
        "RELEASE LOG — default namespace",
        "09:00 shop-web: registry.example.com/shop/web:1.4.2 — smoke test passed",
        "10:20 payment-gateway: payment-gateway:1.8.1 — smoke test passed",
        "10:23 order-api: 2.2.4 -> 2.3.0 (notes: /home/ubuntu/order-api/CHANGELOG.md) — smoke test skipped (hotfix window)",
      ].join("\n"),
    });
    writeFile(state.fs, "/home/ubuntu/order-api/CHANGELOG.md", {
      mtime: state.clock - 3_600_000, content: [
        "# order-api CHANGELOG", "",
        "## 2.3.0",
        "- 결제 호출을 payment-gateway 서비스로 분리",
        "- 설정 추가: PAYMENT_API_URL (예: http://payment-gateway:8080)",
        "- 주문 목록 페이지 정렬 개선", "",
        "## 2.2.4",
        "- 주문 조회 캐시 버그 수정",
      ].join("\n"),
    });
  }],
  rootCause: {
    answerId: "missing-env",
    choices: [
      { id: "missing-env", label: "새 버전(2.3.0)이 요구하는 환경 변수가 Deployment에 없어 컨테이너가 시작 직후 종료된다" },
      { id: "image-pull", label: "새 이미지 태그를 레지스트리에서 받지 못한다",
        whyWrong: "이벤트에 Pulled·Started가 있고 상태는 ImagePullBackOff가 아닌 CrashLoopBackOff입니다. 이미지는 받아서 실행까지 했습니다." },
      { id: "oom", label: "메모리 한도가 작아 컨테이너가 OOMKilled로 종료된다",
        whyWrong: "`kubectl describe pod order-api-0000000002-00001`의 Last State는 Reason Error, Exit Code 1입니다. 메모리 초과라면 OOMKilled, 종료 코드 137이 보입니다." },
      { id: "payment-down", label: "결제 게이트웨이가 내려가 주문 API가 연결하지 못한다",
        whyWrong: "`kubectl get pods`에서 payment-gateway 파드는 Running·Ready이고 `kubectl get endpoints payment-gateway`에도 주소가 있습니다. 로그는 결제를 부르기 전, 설정을 읽는 단계에서 끝납니다." },
      { id: "readiness", label: "readiness probe 경로가 틀려 트래픽만 막혔다",
        whyWrong: "probe만 실패하면 컨테이너는 Running으로 남고 재시작하지 않습니다. 여기서는 재시작 횟수가 계속 늘어납니다." },
    ],
  },
  hints: [
    "파드가 시작했다가 곧 다시 시작되기를 되풀이한다면, 죽기 직전에 무슨 말을 남겼는지 볼 수 있는 곳이 있지 않을까요?",
    "`kubectl describe pod order-api-0000000002-00001`의 Last State와 `kubectl logs deploy/order-api`를 보세요. 무엇이 바뀌었는지는 `kubectl rollout history deployment/order-api`와 releases.txt에 있습니다.",
    "로그에 PAYMENT_API_URL이 없다는 줄이 보이네요. CHANGELOG의 값으로 `kubectl set env deployment/order-api PAYMENT_API_URL=http://payment-gateway:8080`을 넣거나, 급하면 `kubectl rollout undo deployment/order-api`로 2.2.4로 되돌리세요.",
  ],
  resolution: (state) => {
    const cluster = state.kubernetes;
    const deployment = cluster?.deployments.find(d => d.name === "order-api");
    const service = cluster?.services.find(s => s.name === "order-api");
    return !!cluster && !!deployment && !!service && deployment.replicas > 0 && deploymentReady(cluster, deployment)
      && serviceEndpoints(cluster, service).length === deployment.replicas;
  },
  solutionPath: [
    "kubectl get pods",
    "kubectl describe pod order-api-0000000002-00001",
    "kubectl logs deploy/order-api",
    "kubectl rollout history deployment/order-api",
    "cat /home/ubuntu/releases.txt",
    "cat /home/ubuntu/order-api/CHANGELOG.md",
    "kubectl get svc",
    "kubectl set env deployment/order-api PAYMENT_API_URL=http://payment-gateway:8080",
    "kubectl rollout status deployment/order-api",
    "kubectl get endpoints order-api",
  ],
  postmortem: {
    whatHappened: "order-api 2.3.0을 배포한 뒤 새 파드가 시작 직후 설정 오류(종료 코드 1)로 끝나고 재시작을 되풀이했습니다(CrashLoopBackOff). Recreate 배포라 기존 2.2.4 파드는 이미 내려가 Ready 파드가 0개가 되었고, 서비스 엔드포인트가 비어 주문 요청이 실패했습니다.",
    whyItHappened: "2.3.0은 결제 호출을 payment-gateway로 분리하면서 PAYMENT_API_URL 환경 변수를 새로 요구했지만, 배포 매니페스트(Deployment env)에는 반영하지 않았습니다. 핫픽스 시간대라 스모크 테스트도 건너뛰었습니다.",
    howToFix: "급하면 `kubectl rollout undo deployment/order-api`로 서비스를 되돌리거나, `kubectl set env deployment/order-api PAYMENT_API_URL=http://payment-gateway:8080`으로 값을 넣습니다. 이후 `kubectl rollout status deployment/order-api`와 `kubectl get endpoints order-api`로 복구를 확인합니다. 롤백했다면 매니페스트에 값을 넣어 다시 배포해야 근본 해결입니다.",
    howToPrevent: [
      "1) 새 설정 키는 코드와 같은 변경에서 매니페스트(ConfigMap·Secret·env)에 함께 넣고, CI에서 필수 키가 있는지 검사합니다.",
      "2) 스모크 테스트를 건너뛰지 않고, 배포 파이프라인이 Ready 수와 실제 요청 성공까지 확인하게 합니다.",
      "3) 재시작 횟수 증가·가용 파드 0개 경보를 두고, RollingUpdate(maxUnavailable)로 새 파드 실패가 서비스 중단으로 번지지 않게 합니다.",
    ].join("\n"),
    realWorldNote: "CrashLoopBackOff에서는 로그가 가장 빠른 단서입니다. 컨테이너가 이미 다시 시작해 실행 중이라면 `kubectl logs order-api-0000000002-00001 --previous`처럼 직전 실행 로그를 봅니다. 이 실습은 재시작 횟수를 시각으로 계산하고 명령 직후 상태를 반영합니다. 실제 back-off 대기·RollingUpdate·ConfigMap/Secret 참조는 재현하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Kubernetes Pod Lifecycle — How Pods handle problems with containers (CrashLoopBackOff)", url: "https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/" },
    { kind: "official-doc", title: "Kubernetes — Debug Running Pods (kubectl logs --previous)", url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/" },
    { kind: "official-doc", title: "kubectl rollout undo", url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_rollout/kubectl_rollout_undo/" },
    { kind: "official-doc", title: "kubectl set env", url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_set/kubectl_set_env/" },
  ],
};
