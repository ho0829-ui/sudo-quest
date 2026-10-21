import { withCommands } from "../engine/commands";
import type { Scenario } from "../engine/scenario/types";
import { changeTemplate } from "../engine/state/kubernetes/history";
import { deploymentReady, reconcileKubernetes, serviceEndpoints } from "../engine/state/kubernetes/reconcile";

export const kubernetesImagePull: Scenario = {
  id: "kubernetes-image-pull",
  title: "배포 후 쇼핑몰이 돌아오지 않아요",
  category: "kubernetes",
  difficulty: 2,
  ticket: [
    "09:10 배포 작업 이후 쇼핑몰 요청이 실패하고 있습니다. 잠깐의 중단을 예상했는데 5분째 복구되지 않습니다.",
    "default 네임스페이스의 shop-web을 확인해 주세요. 같은 클러스터의 status-page는 정상입니다.",
    "배포 기록은 운영 호스트의 /home/ubuntu/releases.txt에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "Deployment·Pod·Service의 관찰 결과를 연결해 장애 범위를 좁힌다",
    "ImagePullBackOff와 컨테이너 실행 중 장애를 이벤트로 구분한다",
    "이미지 변경 성공 뒤 Ready 수와 엔드포인트를 확인해 실제 복구를 검증한다",
  ],
  host: "kubernetes-admin",
  commands: withCommands("kubectl"),
  faults: [(state) => {
    const cluster = state.kubernetes!;
    const deployment = cluster.deployments.find(d => d.name === "shop-web")!;
    changeTemplate(deployment, "release web:1.4.22", template => { template.containers[0].image = "registry.example.com/shop/web:1.4.22"; });
    reconcileKubernetes(cluster, state.clock - 300_000);
  }],
  rootCause: {
    answerId: "missing-image-tag",
    choices: [
      { id: "missing-image-tag", label: "Deployment의 이미지 태그가 잘못되어 레지스트리에서 이미지를 가져오지 못한다" },
      { id: "node-down", label: "워커 노드가 모두 중단되어 파드를 배치할 수 없다",
        whyWrong: "`kubectl get nodes`의 두 노드는 Ready이며 파드도 노드에 배치되었습니다. status-page 파드 역시 실행 중입니다." },
      { id: "bad-selector", label: "Service의 selector가 파드 라벨과 달라 트래픽이 전달되지 않는다",
        whyWrong: "`kubectl get svc -o wide`의 selector와 `kubectl describe pods`의 라벨은 일치합니다. 엔드포인트가 비어 있는 이유는 대상 파드가 Ready가 아니기 때문입니다." },
      { id: "app-crash", label: "애플리케이션이 시작된 뒤 오류로 반복 종료된다",
        whyWrong: "컨테이너는 Waiting 상태이고 재시작 횟수는 0입니다. 이벤트의 이미지 참조 not found가 실행 이전 단계의 실패임을 알려 줍니다." },
    ],
  },
  hints: [
    "정상인 서비스와 문제가 생긴 서비스가 같은 클러스터에 있습니다. 파드가 어디까지 시작됐는지 비교해 보면 어떨까요?",
    "`kubectl get pods -o wide`로 상태를 비교하고 `kubectl describe pods`와 `kubectl get events`에서 시작을 막는 이유를 찾아보세요.",
    "이벤트에 이미지 참조 not found가 보입니다. `cat /home/ubuntu/releases.txt`의 마지막 정상 버전과 `kubectl describe deploy shop-web`의 이미지를 비교하고 web 컨테이너의 태그를 바로잡으세요.",
  ],
  resolution: (state) => {
    const cluster = state.kubernetes;
    if (!cluster) return false;
    const deployment = cluster.deployments.find(d => d.name === "shop-web");
    const service = cluster.services.find(s => s.name === "shop-web");
    return !!deployment && !!service && deployment.replicas > 0 && deploymentReady(cluster, deployment)
      && serviceEndpoints(cluster, service).length === deployment.replicas;
  },
  solutionPath: [
    "kubectl get deploy",
    "kubectl get pods -o wide",
    "kubectl describe pods",
    "kubectl get events",
    "kubectl get svc -o wide",
    "kubectl get endpoints shop-web",
    "cat /home/ubuntu/releases.txt",
    "kubectl set image deployment/shop-web web=registry.example.com/shop/web:1.4.2",
    "kubectl rollout status deployment/shop-web",
    "kubectl get endpoints shop-web",
  ],
  postmortem: {
    whatHappened: "Recreate 전략의 shop-web 배포에서 기존 파드를 내린 뒤 새 파드가 이미지를 받지 못했습니다. Ready 파드가 없어 Service 엔드포인트도 비었고 쇼핑몰 요청이 실패했습니다.",
    whyItHappened: "검증된 태그 1.4.2 대신 존재하지 않는 1.4.22를 배포했습니다. API가 이미지 설정 변경을 받아들인 것을 애플리케이션 복구로 오해하고 배포를 마쳤습니다.",
    howToFix: "`kubectl set image deployment/shop-web web=registry.example.com/shop/web:1.4.2`로 확인된 버전을 적용한 뒤 `kubectl rollout status deployment/shop-web`와 `kubectl get endpoints shop-web`로 복구를 확인합니다.",
    howToPrevent: "배포 전에 이미지 존재 여부와 digest를 검증하고, 배포 파이프라인이 Ready 수와 실제 요청 성공까지 확인하게 합니다. 서비스 특성에 맞는 배포 전략을 선택하고, 가용 파드 0개·이미지 풀 실패에 경보를 설정합니다.",
    realWorldNote: "ImagePullBackOff는 잘못된 이미지 이름뿐 아니라 레지스트리 인증·연결 실패로도 발생합니다. 실제 Kubernetes는 시간을 늘리며 재시도하므로 이벤트의 구체적 오류를 확인해야 합니다. 이 실습은 단일 네임스페이스·Recreate 전략을 사용하고, 명령 직후 상태를 계산합니다. 실제 재시도 지연·watch·RollingUpdate·인증은 재현하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Kubernetes Images — ImagePullBackOff", url: "https://kubernetes.io/docs/concepts/containers/images/" },
    { kind: "official-doc", title: "Kubernetes — Debug Running Pods", url: "https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/" },
    { kind: "official-doc", title: "kubectl set image", url: "https://kubernetes.io/docs/reference/kubectl/generated/kubectl_set/kubectl_set_image/" },
  ],
};
