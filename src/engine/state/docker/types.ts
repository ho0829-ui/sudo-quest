/**
 * 가상 Docker 엔진(한 호스트의 dockerd). 실제 Docker 소켓에는 접속하지 않는다.
 * 화면 상태(Up·Exited·Restarting)는 저장하지 않고 runtime.ts가 시각으로 계산한다.
 */
import type { ImageProfile, TerminatedState } from "../containers/types";

export interface DockerImage {
  repository: string;
  tag: string;
  /** sha256 뒤 64자리. 화면에는 앞 12자리만 보인다. */
  id: string;
  createdAt: number;
  /** 아래부터 위로 쌓인 레이어 ID. 크기는 /var/lib/docker/overlay2의 레이어 파일에서 계산한다(storage.ts). */
  layers: string[];
  /** 컨테이너를 만들 때 쓰는 기본 명령 (docker ps의 COMMAND) */
  cmd: string[];
  /** 이미지에 들어 있는 기본 환경 변수(PATH 등). docker inspect의 Config.Env에 함께 보인다. */
  env?: Record<string, string>;
  profile: ImageProfile;
}

export interface RestartPolicy {
  name: "no" | "always" | "unless-stopped" | "on-failure";
  /** on-failure의 최대 재시도 횟수. 0이면 제한 없음 */
  maximumRetryCount: number;
}

export interface PortBinding {
  /** 비어 있으면 모든 주소(0.0.0.0) */
  hostIp: string;
  hostPort: number;
  containerPort: number;
  proto: "tcp" | "udp";
}

export interface DockerContainer {
  id: string;
  name: string;
  /** 사용자가 입력한 이미지 이름 그대로 (docker ps의 IMAGE) */
  image: string;
  imageId: string;
  cmd: string[];
  createdAt: number;
  /** -e·--env-file로 넣은 값. 컨테이너를 만든 뒤에는 바꿀 수 없다(다시 만들어야 한다). */
  env: Record<string, string>;
  ports: PortBinding[];
  restart: RestartPolicy;
  /**
   * 저장 상태. crashing은 "실행하자마자 끝나고 재시작 정책으로 다시 뜨기를 반복하는 중"이다.
   * 재시작 횟수와 Restarting/Exited 표시는 startedAt부터 지난 시간으로 계산한다.
   */
  state: "created" | "running" | "exited" | "crashing";
  startedAt?: number;
  finishedAt?: number;
  exitCode: number;
  /** 직전 실행이 끝난 이유. crashing·exited에서 쓴다. */
  last?: TerminatedState;
  /** 이번 시작 전까지 끝난 실행 수. docker logs는 실행마다 로그를 이어 붙인다. */
  pastRuns: number;
  /** docker stop으로 멈췄는가. unless-stopped 정책이 데몬 재시작 때 참고한다. */
  manuallyStopped: boolean;
  /** 마지막 시작 실패 사유 (docker inspect의 State.Error) */
  error: string;
  ip?: string;
}

/** BuildKit 빌드 캐시 한 건. 크기는 /var/lib/docker/buildkit/cache의 파일에서 계산한다. */
export interface BuildCacheRecord {
  id: string;
  description: string;
  lastUsed: number;
  /** 어떤 이미지도 참조하지 않는 캐시. docker builder prune(기본)은 이것만, -a는 전부 지운다. */
  dangling: boolean;
}

export interface DockerState {
  images: DockerImage[];
  containers: DockerContainer[];
  buildCache: BuildCacheRecord[];
}
