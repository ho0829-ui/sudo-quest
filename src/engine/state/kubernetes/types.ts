/** 단일 default 네임스페이스의 가상 클러스터. 실제 Kubernetes API에는 접속하지 않는다. */
export interface ImageProfile {
  ports: number[];
  paths: string[];
}

export interface ContainerSpec {
  name: string;
  image: string;
  readinessProbe?: { path: string; port: number };
}

export interface PodTemplate {
  labels: Record<string, string>;
  containers: ContainerSpec[];
}

export interface KubeDeployment {
  name: string;
  replicas: number;
  revision: number;
  createdAt: number;
  /** 첫 단계는 Recreate만 모델링한다. RollingUpdate의 무중단 보장을 흉내 내지 않는다. */
  strategy: "Recreate";
  template: PodTemplate;
}

export interface KubeContainer extends ContainerSpec {
  state: "Running" | "Waiting";
  reason?: "ImagePullBackOff" | "ContainerCreating";
  ready: boolean;
  restartCount: number;
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
