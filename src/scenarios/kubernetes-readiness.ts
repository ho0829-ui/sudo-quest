import { withCommands } from "../engine/commands/names";
import type { Scenario } from "../engine/scenario/types";
import { writeFile } from "../engine/state/fs";
import { addDeployment, changeTemplate } from "../engine/state/kubernetes/history";
import { deploymentReady, reconcileKubernetes, serviceEndpoints } from "../engine/state/kubernetes/reconcile";

const OLD = "registry.example.com/shop/search-api:2.4.1";
const NEW = "registry.example.com/shop/search-api:3.0.0";
const POD = "search-api-0000000002-00001";
const PATCH = `kubectl patch deployment search-api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","readinessProbe":{"httpGet":{"path":"/healthz","port":8080}}}]}}}}'`;

export const kubernetesReadiness: Scenario = {
  id: "kubernetes-readiness",
  title: "배포 뒤 검색만 계속 실패해요",
  category: "kubernetes",
  difficulty: 2,
  ticket: [
    "10:10 search-api 3.0.0 배포 뒤부터 쇼핑몰 검색창에 \"일시적인 오류입니다\"만 나옵니다.",
    "모니터링으로는 search-api 파드가 재시작 없이 떠 있다고 하고, 다른 화면은 정상입니다.",
    "default 네임스페이스이고, 배포 기록은 운영 호스트의 /home/ubuntu에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "Running과 Ready가 다르다는 것, Ready가 아닌 파드는 서비스 엔드포인트에서 빠진다는 것을 확인한다",
    "describe의 Conditions·Events와 앱 접근 로그로 readiness probe 실패(404)를 찾는다",
    "probe 설정을 앱에 맞게 고치고(kubectl patch) 엔드포인트 복구로 검증한다",
  ],
  host: "kubernetes-admin",
  commands: withCommands("kubectl"),
  faults: [(state) => {
    const cluster = state.kubernetes!;
    const installed = state.clock - 5 * 86_400_000;
    cluster.images[OLD] = { ports: [8080], paths: ["/health"], accessLog: true,
      log: { boot: ["INFO  search-api 2.4.1 starting", "INFO  index loaded (312,904 documents)"], ready: ["INFO  listening on :8080"] } };
    // 3.0.0은 헬스 체크 경로를 /healthz로 옮겼다. 이미지가 응답하는 경로가 probe 판정을 정한다.
    cluster.images[NEW] = { ports: [8080], paths: ["/healthz"], accessLog: true,
      log: { boot: ["INFO  search-api 3.0.0 starting", "INFO  index loaded (312,904 documents)"],
        ready: ["INFO  routes: GET /search, GET /suggest, GET /healthz", "INFO  listening on :8080"] } };
    addDeployment(cluster, { name: "search-api", replicas: 2, labels: { app: "search-api" }, createdAt: installed,
      containers: [{ name: "api", image: OLD, readinessProbe: { path: "/health", port: 8080 },
        resources: { requests: { memoryMi: 256 }, limits: { memoryMi: 512 } } }],
      changeCause: "release search-api:2.4.1", service: { clusterIP: "10.96.0.60", port: 80, targetPort: 8080 } });
    reconcileKubernetes(cluster, installed);
    // 장애: 이미지만 올리고 매니페스트의 readinessProbe 경로(/health)는 그대로 두었다.
    const search = cluster.deployments.find(d => d.name === "search-api")!;
    changeTemplate(search, "release search-api:3.0.0", template => { template.containers[0].image = NEW; });
    reconcileKubernetes(cluster, state.clock - 600_000);
    writeFile(state.fs, "/home/ubuntu/releases.txt", { mtime: state.clock - 600_000, content: [
      "RELEASE LOG — default namespace",
      "09:00 shop-web: registry.example.com/shop/web:1.4.2 — smoke test passed",
      "10:10 search-api: 2.4.1 -> 3.0.0 (notes: /home/ubuntu/search-api/RELEASE_NOTES.md) — kubectl set image",
    ].join("\n") });
    writeFile(state.fs, "/home/ubuntu/search-api/RELEASE_NOTES.md", { mtime: state.clock - 86_400_000, content: [
      "# search-api 3.0.0", "",
      "- 검색 랭킹 개선, 자동완성 /suggest 추가",
      "- 헬스 체크 경로 변경: /health → /healthz (/health는 제거)",
      "- 기본 포트는 그대로 8080",
    ].join("\n") });
  }],
  rootCause: {
    answerId: "probe-path",
    choices: [
      { id: "probe-path", label: "readinessProbe가 3.0.0에서 없어진 /health를 검사해 404로 실패하고, Ready가 아닌 파드가 서비스 엔드포인트에서 빠졌다" },
      { id: "crash", label: "새 버전이 시작 직후 오류로 종료되기를 반복한다",
        whyWrong: "`kubectl get pods`에서 STATUS는 Running, RESTARTS는 0입니다. 로그에도 listening on :8080까지 찍혀 앱은 떠 있습니다." },
      { id: "image-pull", label: "새 이미지를 레지스트리에서 받지 못한다",
        whyWrong: "이벤트에 Pulled·Started가 있고 컨테이너가 Running입니다. 이미지 문제라면 ImagePullBackOff가 보입니다." },
      { id: "selector", label: "서비스 셀렉터가 새 파드 라벨과 맞지 않는다",
        whyWrong: "`kubectl get pods -l app=search-api`로 새 파드가 그대로 골라집니다. 셀렉터는 맞지만 파드가 Ready가 아니라서(Conditions의 Ready False) 엔드포인트에서 빠졌습니다." },
      { id: "app-500", label: "검색 코드 버그로 요청마다 500 오류를 낸다",
        whyWrong: "엔드포인트가 비어 있어 검색 요청은 파드까지 오지도 못합니다. 앱 로그에는 kube-probe의 GET /health 404만 찍힙니다." },
    ],
  },
  hints: [
    "\"떠 있다\"와 \"요청을 받을 준비가 됐다\"는 같은 뜻일까요? 쿠버네티스가 그 둘을 어떻게 구분해 기록하는지 살펴보세요.",
    `\`kubectl get pods\`의 READY 열, \`kubectl get endpoints search-api\`, \`kubectl describe pod ${POD}\`의 Conditions·Events와 \`kubectl logs ${POD}\`를 보세요.`,
    `readiness probe가 /health에서 404를 받고 있어요. 3.0.0은 /healthz를 씁니다. \`${PATCH}\`로 probe 경로를 고치세요.`,
  ],
  resolution: (state) => {
    const cluster = state.kubernetes;
    const deployment = cluster?.deployments.find(d => d.name === "search-api");
    const service = cluster?.services.find(s => s.name === "search-api");
    return !!cluster && !!deployment && !!service && deployment.replicas > 0 && deploymentReady(cluster, deployment)
      && serviceEndpoints(cluster, service).length === deployment.replicas;
  },
  solutionPath: [
    "kubectl get pods",
    "kubectl get endpoints search-api",
    `kubectl describe pod ${POD}`,
    `kubectl logs ${POD} --tail=3`,
    "kubectl rollout history deployment/search-api",
    "cat /home/ubuntu/search-api/RELEASE_NOTES.md",
    PATCH,
    "kubectl rollout status deployment/search-api",
    "kubectl get endpoints search-api",
  ],
  postmortem: {
    whatHappened: "search-api 3.0.0 파드는 정상 기동(Running, 재시작 0)했지만 readinessProbe가 검사하는 /health가 3.0.0에서 없어져 404로 실패했습니다. Ready가 아닌 파드는 서비스 엔드포인트에서 빠지므로 search-api 서비스에 보낼 곳이 없어 검색 요청이 모두 실패했습니다.",
    whyItHappened: "앱이 헬스 체크 경로를 /healthz로 바꿨지만 배포 매니페스트의 readinessProbe는 그대로 /health였습니다. 이미지 태그만 kubectl set image로 바꿔 매니페스트 검토가 없었고, Recreate 전략이라 옛 파드가 먼저 모두 내려가 전면 장애가 됐습니다.",
    howToFix: `\`${PATCH}\`로 probe 경로를 /healthz로 고치고 \`kubectl rollout status deployment/search-api\`, \`kubectl get endpoints search-api\`로 확인합니다. 급하면 \`kubectl rollout undo deployment/search-api\`로 2.4.1(/health 응답)로 되돌린 뒤 매니페스트를 고쳐 다시 배포합니다.`,
    howToPrevent: [
      "1) 헬스 체크 경로·포트 변경은 코드와 같은 PR에서 매니페스트(probe)를 함께 바꾸고, CI에서 이미지가 probe 경로에 200을 주는지 검사합니다.",
      "2) RollingUpdate(maxUnavailable)를 쓰면 새 파드가 Ready가 되지 않을 때 옛 파드가 남아 전면 장애를 막습니다.",
      "3) Ready 파드 수·엔드포인트 0개 경보를 두고, 배포 파이프라인이 rollout status 성공까지 기다리게 합니다.",
    ].join("\n"),
    realWorldNote: "readiness probe가 실패한 컨테이너는 재시작되지 않고(그건 liveness probe의 일) 트래픽에서만 빠집니다. 그래서 \"재시작 없이 떠 있는데 서비스가 안 된다\"가 전형적인 증상입니다. 이 실습은 probe를 주기 없이 즉시 판정하며, 실제 periodSeconds·failureThreshold 누적과 RollingUpdate는 재현하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Kubernetes Pod Lifecycle — Readiness probe", url: "https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#readiness-probe" },
    { kind: "official-doc", title: "Kubernetes — Configure Liveness, Readiness and Startup Probes: Define readiness probes", url: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes" },
    { kind: "official-doc", title: "kubectl patch", url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_patch/" },
  ],
};
