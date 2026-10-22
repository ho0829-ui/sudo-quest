/** 단일 default 네임스페이스의 가상 클러스터. 실제 Kubernetes API에는 접속하지 않는다. */
import type { ImageProfile, TerminatedState } from "../containers/types";

// 이미지 정보와 종료 모습은 Docker와 함께 쓰는 타입이다(containers/types.ts).
export type { ImageProfile, TerminatedState };

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
  /** 만든 뒤 바꿀 수 없는 파드 셀렉터. 없으면 템플릿 라벨과 같다. 템플릿 라벨은 늘 이것을 포함해야 한다. */
  selector?: Record<string, string>;
}

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
