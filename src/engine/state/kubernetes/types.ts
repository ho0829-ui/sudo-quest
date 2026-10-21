/** 단일 default 네임스페이스의 가상 클러스터. 실제 Kubernetes API에는 접속하지 않는다. */
export interface ImageProfile {
  ports: number[];
  paths: string[];
  /** 시작할 때 반드시 있어야 하는 환경 변수. 하나라도 없으면 설정 오류로 종료 코드 1을 내고 끝난다. */
  requiredEnv?: string[];
  /** 정상 동작에 필요한 메모리(MiB). 컨테이너 memory limit보다 크면 OOMKilled(137)로 끝난다. */
  memoryMi?: number;
  /** 컨테이너 로그. boot는 시작하면 항상 찍고, ready는 정상 기동했을 때만 이어서 찍는다. */
  log?: { boot: string[]; ready: string[] };
}

/** 메모리는 MiB 숫자로 저장하고, 화면에는 128Mi처럼 보여 준다. cpu는 값만 보관한다. */
export interface ResourceList { memoryMi?: number; cpu?: string }

export interface ContainerSpec {
  name: string;
  image: string;
  readinessProbe?: { path: string; port: number };
  env?: Record<string, string>;
  resources?: { requests?: ResourceList; limits?: ResourceList };
}

export interface PodTemplate {
  labels: Record<string, string>;
  containers: ContainerSpec[];
}

/** rollout history/undo용 기록. 실제처럼 같은 템플릿은 한 줄만 남긴다. */
export interface DeploymentRevision {
  revision: number;
  template: PodTemplate;
  changeCause: string;
}

export interface KubeDeployment {
  name: string;
  replicas: number;
  revision: number;
  createdAt: number;
  /** 첫 단계는 Recreate만 모델링한다. RollingUpdate의 무중단 보장을 흉내 내지 않는다. */
  strategy: "Recreate";
  template: PodTemplate;
  history: DeploymentRevision[];
}

/** 직전 실행이 끝난 모습. kubectl describe의 Last State와 kubectl logs --previous가 쓴다. */
export interface TerminatedState { reason: "Error" | "OOMKilled"; exitCode: number }

export interface KubeContainer extends ContainerSpec {
  state: "Running" | "Waiting";
  reason?: "ImagePullBackOff" | "ContainerCreating" | "CrashLoopBackOff";
  ready: boolean;
  restartCount: number;
  lastState?: TerminatedState;
  /** 반복 종료가 시작된 시각. 재시작 횟수는 이 시각부터 현재 시각까지의 back-off 간격으로 계산한다. */
  crashingSince?: number;
}

export interface KubePod {
  name: string;
  deployment: string;
  revision: number;
  labels: Record<string, string>;
  node?: string;
  ip?: string;
  createdAt: number;
  phase: "Pending" | "Running";
  containers: KubeContainer[];
}

export interface KubeService {
  name: string;
  selector: Record<string, string>;
  clusterIP: string;
  port: number;
  targetPort: number;
  createdAt: number;
}

export interface KubeEvent {
  name: string;
  pod: string;
  time: number;
  type: "Normal" | "Warning";
  reason: string;
  message: string;
}

export interface KubernetesState {
  nodes: { name: string; ready: boolean; ip: string; createdAt: number }[];
  images: Record<string, ImageProfile>;
  deployments: KubeDeployment[];
  pods: KubePod[];
  services: KubeService[];
  events: KubeEvent[];
}
