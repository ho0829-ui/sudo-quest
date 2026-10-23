/**
 * Kubernetes 파드와 Docker 컨테이너가 함께 쓰는 "이미지가 어떻게 동작하는가" 정보.
 * 둘 다 같은 규칙(runtime.ts)으로 종료 여부·로그를 계산하므로, 새 실습은 이미지 정보만 정하면 된다.
 */
export interface ImageProfile {
  ports: number[];
  /** readiness·헬스 체크에 응답하는 경로 */
  paths: string[];
  /** 시작할 때 반드시 있어야 하는 환경 변수. 하나라도 없으면 설정 오류로 종료 코드 1을 내고 끝난다. */
  requiredEnv?: string[];
  /** 정상 동작에 필요한 메모리(MiB). 컨테이너 memory limit보다 크면 OOMKilled(137)로 끝난다. */
  memoryMi?: number;
  /** 컨테이너 로그. boot는 시작하면 항상 찍고, ready는 정상 기동했을 때만 이어서 찍는다. */
  log?: { boot: string[]; ready: string[] };
  /** 정상 동작 중 HTTP 경로별 응답 본문(200). 없는 경로는 404. curl로 컨테이너에 직접 요청할 때 쓴다. */
  responses?: Record<string, string>;
  /** 그 응답의 헤더(Server, Content-Type 등). 앱 종류마다 다르다. */
  headers?: Record<string, string>;
  /** 요청마다 접근 로그를 남기는 앱인가. 남기면 kubelet의 readiness 요청도 로그에 찍힌다(kubectl logs). */
  accessLog?: boolean;
}

/** 직전 실행이 끝난 모습. kubectl describe의 Last State, docker inspect의 State가 쓴다. */
export interface TerminatedState { reason: "Error" | "OOMKilled"; exitCode: number }

/** 실행 결과를 정하는 컨테이너 설정. K8s·Docker의 서로 다른 설정 모양을 이 모양으로 바꿔 넘긴다. */
export interface RunSpec {
  env?: Record<string, string>;
  memoryLimitMi?: number;
}
