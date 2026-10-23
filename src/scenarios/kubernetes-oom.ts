import { withCommands } from "../engine/commands/names";
import type { Scenario } from "../engine/scenario/types";
import { writeFile } from "../engine/state/fs";
import { addDeployment, changeTemplate } from "../engine/state/kubernetes/history";
import { deploymentReady, reconcileKubernetes, serviceEndpoints } from "../engine/state/kubernetes/reconcile";

const CATALOG = "registry.example.com/shop/catalog-api:3.1.0";

export const kubernetesOom: Scenario = {
  id: "kubernetes-oom",
  title: "오후 작업 뒤 상품 목록이 텅 비었어요",
  category: "kubernetes",
  difficulty: 3,
  ticket: [
    "14:00 정기 변경 작업 이후 상품 목록이 비어 보이고 검색이 전부 실패합니다.",
    "catalog-api 파드가 계속 재시작된다는 알림이 오는데, 개발팀은 애플리케이션 오류 로그가 특별히 없다고 합니다.",
    "default 네임스페이스이고, 작업 기록은 운영 호스트의 /home/ubuntu에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "get pods의 CrashLoopBackOff 뒤에 숨은 종료 이유(OOMKilled·137)를 describe의 Last State로 확인한다",
    "OOM은 앱 로그에 원인이 남지 않는다는 점과 메모리 request·limit의 차이를 이해한다",
    "rollout history로 바뀐 리소스 설정을 찾고, limit 조정이나 롤백으로 복구를 검증한다",
  ],
  host: "kubernetes-admin",
  commands: withCommands("kubectl"),
  faults: [(state) => {
    const cluster = state.kubernetes!;
    const installed = state.clock - 86_400_000;
    // 캐시를 올리는 데 약 280Mi, 동작 중 약 300Mi가 필요하다. 출력은 이 값과 limit을 비교해 계산된다.
    cluster.images[CATALOG] = { ports: [8080], paths: ["/healthz"], memoryMi: 300,
      log: { boot: ["INFO  catalog-api 3.1.0 starting", "INFO  connected to catalog-db:5432",
        "INFO  loading product catalog cache (48,210 items, est. 280Mi)"],
        ready: ["INFO  cache warm in 6.2s", "INFO  listening on :8080"] } };
    addDeployment(cluster, { name: "catalog-api", replicas: 2, labels: { app: "catalog-api" }, createdAt: installed,
      containers: [{ name: "api", image: CATALOG, readinessProbe: { path: "/healthz", port: 8080 }, env: { CACHE_MODE: "full" },
        resources: { requests: { memoryMi: 256 }, limits: { memoryMi: 512 } } }],
      changeCause: "release catalog-api:3.1.0", service: { clusterIP: "10.96.0.50", port: 80, targetPort: 8080 } });
    reconcileKubernetes(cluster, installed);
    // 장애: 야간 측정값만 보고 limit을 줄였다(kubectl로 직접 적용).
    const catalog = cluster.deployments.find(d => d.name === "catalog-api")!;
    changeTemplate(catalog, "rightsizing: memory limit 512Mi -> 128Mi (cost review #412)", template => {
      template.containers[0].resources = { requests: { memoryMi: 64 }, limits: { memoryMi: 128 } };
    });
    reconcileKubernetes(cluster, state.clock - 900_000);
    writeFile(state.fs, "/home/ubuntu/releases.txt", {
      mtime: state.clock - 900_000, content: [
        "CHANGE LOG — default namespace",
        "어제 09:00 catalog-api: registry.example.com/shop/catalog-api:3.1.0 — smoke test passed",
        "14:00 cost review #412 적용 (catalog-api 리소스 조정, 상세: /home/ubuntu/cost-review-412.md)",
      ].join("\n"),
    });
    writeFile(state.fs, "/home/ubuntu/cost-review-412.md", {
      mtime: state.clock - 1_200_000, content: [
        "# Cost review #412 — memory rightsizing", "",
        "측정 구간: 03:00~03:10 (야간 재배포 직후)",
        "- catalog-api: p95 96Mi  → limit 512Mi -> 128Mi, request 256Mi -> 64Mi 제안",
        "- status-page: p95 40Mi  → 변경 없음", "",
        "적용: 14:00 kubectl로 직접 적용 (매니페스트 반영은 다음 주)",
      ].join("\n"),
    });
  }],
  rootCause: {
    answerId: "oom-limit",
    choices: [
      { id: "oom-limit", label: "메모리 limit(128Mi)이 앱이 실제로 쓰는 메모리보다 작아 컨테이너가 OOMKilled로 종료된다" },
      { id: "app-bug", label: "새 코드의 버그로 앱이 예외를 내고 종료된다",
        whyWrong: "Last State의 Exit Code는 137(SIGKILL), Reason은 OOMKilled입니다. 앱 예외라면 보통 종료 코드 1과 오류 줄이 남는데, `kubectl logs catalog-api-0000000002-00001 --previous`는 캐시 적재 줄에서 오류 없이 끊깁니다. 이미지도 어제와 같은 3.1.0입니다." },
      { id: "node-memory", label: "노드 메모리가 부족해 노드가 파드를 쫓아낸다(eviction)",
        whyWrong: "`kubectl get nodes`의 두 노드는 Ready이고 같은 노드의 다른 파드는 정상입니다. 노드 압박으로 쫓겨나면 Evicted가 보이는데, 여기서는 컨테이너가 자기 limit을 넘어 OOMKilled가 났습니다." },
      { id: "db-down", label: "catalog-db 연결이 실패해 시작하지 못한다",
        whyWrong: "로그는 DB 연결 다음 단계(캐시 적재)까지 진행했습니다. 연결 실패라면 오류 줄과 종료 코드 1이 남습니다." },
      { id: "readiness", label: "readiness probe 경로가 틀려 트래픽만 막혔다",
        whyWrong: "probe만 실패하면 컨테이너는 Running으로 남고 재시작하지 않습니다. 여기서는 컨테이너가 끝나고 재시작 횟수가 늘어납니다." },
    ],
  },
  hints: [
    "앱이 스스로 오류를 남기지 못하고 끝나는 경우도 있어요. 컨테이너가 '어떻게' 끝났는지 기록이 남는 곳이 있지 않을까요?",
    "`kubectl describe pod catalog-api-0000000002-00001`의 Last State(Reason·Exit Code)와 Limits, `kubectl logs catalog-api-0000000002-00001 --previous`, `kubectl rollout history deployment/catalog-api`를 함께 보세요.",
    "Last State가 OOMKilled(137)이고 Limits는 128Mi인데 로그는 캐시를 약 280Mi 올리다 끊겼네요. `kubectl set resources deployment/catalog-api -c=api --limits=memory=512Mi`로 늘리거나 `kubectl rollout undo deployment/catalog-api`로 되돌리세요.",
  ],
  resolution: (state) => {
    const cluster = state.kubernetes;
    const deployment = cluster?.deployments.find(d => d.name === "catalog-api");
    const service = cluster?.services.find(s => s.name === "catalog-api");
    return !!cluster && !!deployment && !!service && deployment.replicas > 0 && deploymentReady(cluster, deployment)
      && serviceEndpoints(cluster, service).length === deployment.replicas;
  },
  solutionPath: [
    "kubectl get pods",
    "kubectl describe pod catalog-api-0000000002-00001",
    "kubectl logs catalog-api-0000000002-00001 --previous",
    "kubectl rollout history deployment/catalog-api",
    "cat /home/ubuntu/cost-review-412.md",
    "kubectl set resources deployment/catalog-api -c=api --limits=memory=512Mi",
    "kubectl rollout status deployment/catalog-api",
    "kubectl get endpoints catalog-api",
  ],
  postmortem: {
    whatHappened: "14:00 비용 최적화로 catalog-api의 메모리 limit을 512Mi에서 128Mi로 줄이자, 시작하며 상품 캐시(약 280Mi)를 올리던 컨테이너가 limit을 넘어 커널(cgroup)에 강제 종료되고(OOMKilled, 종료 코드 137) 재시작을 되풀이했습니다. Ready 파드가 없어 서비스 엔드포인트가 비었습니다.",
    whyItHappened: "사용량을 야간 재배포 직후, 캐시를 올리기 전 구간에서만 측정해 실제 최대 사용량을 과소평가했습니다. 변경을 매니페스트가 아니라 kubectl로 직접 적용해 검토·스테이징 검증 없이 운영에 바로 들어갔습니다.",
    howToFix: "`kubectl set resources deployment/catalog-api -c=api --limits=memory=512Mi`로 limit을 실제 사용량보다 넉넉히 늘리거나 `kubectl rollout undo deployment/catalog-api`로 이전 설정으로 되돌린 뒤, `kubectl rollout status deployment/catalog-api`와 `kubectl get endpoints catalog-api`로 확인합니다. request만 올리면 limit은 그대로라 계속 죽습니다.",
    howToPrevent: [
      "1) limit은 시작·피크를 포함한 기간의 최대 사용량(p99·max)에 여유를 두고 정합니다. 짧은 야간 구간의 p95로 정하지 않습니다.",
      "2) 리소스 변경도 매니페스트 PR로 검토하고, 스테이징에서 부하와 함께 검증한 뒤 적용합니다.",
      "3) 컨테이너 OOMKilled·재시작 증가 경보와 메모리 사용량/limit 대시보드를 둡니다. 캐시는 limit 안에서 크기를 제한하거나 지연 적재합니다.",
    ].join("\n"),
    realWorldNote: "OOMKilled는 앱이 아니라 커널이 SIGKILL로 끝내므로 앱 로그에는 원인이 남지 않습니다. `kubectl describe pod catalog-api-0000000002-00001`의 Last State(Reason OOMKilled, Exit Code 137)가 결정적 단서입니다. 노드 전체 메모리 부족으로 쫓겨나는 Evicted와는 다릅니다. 이 실습은 앱 메모리 사용량을 고정값으로 두고 명령 직후 상태를 계산하며, kubectl top·실시간 사용량 변화는 재현하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Kubernetes — Assign Memory Resources: Exceed a Container's memory limit (OOMKilled)", url: "https://kubernetes.io/docs/tasks/configure-pod-container/assign-memory-resource/" },
    { kind: "official-doc", title: "Kubernetes Pod Lifecycle — Container states (Terminated)", url: "https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/" },
    { kind: "official-doc", title: "kubectl set resources", url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_set/kubectl_set_resources/" },
  ],
};
