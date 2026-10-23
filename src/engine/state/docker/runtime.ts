/**
 * 컨테이너의 "지금 모습"을 저장 상태와 시각으로 계산한다.
 * 재시작 정책으로 반복해서 뜨는 컨테이너는 재시작 횟수를 쌓지 않고 시작 시각부터 지난 시간으로 센다.
 */
import { runLog } from "../containers/runtime";
import type { RunSpec } from "../containers/types";
import type { DockerContainer, DockerImage, DockerState } from "./types";

export interface ContainerView {
  status: "created" | "running" | "restarting" | "exited";
  restartCount: number;
  exitCode: number;
  startedAt?: number;
  finishedAt?: number;
}

/**
 * Docker 문서: 재시작 사이에 100ms부터 두 배씩 늘어나는 지연을 둔다. 상한 1분은 Docker 엔진의 기본값이다.
 * since부터 elapsed 동안 몇 번 재시작했는지와 마지막으로 끝난 시각을 돌려준다.
 */
function restartsWithin(elapsed: number, limit: number): { count: number; spent: number } {
  let count = 0;
  let spent = 0;
  for (let delay = 100; spent + delay <= elapsed && (limit === 0 || count < limit); delay = Math.min(delay * 2, 60_000)) {
    spent += delay;
    count++;
  }
  return { count, spent };
}

export function containerView(container: DockerContainer, clock: number): ContainerView {
  const { state, startedAt, finishedAt, exitCode } = container;
  if (state !== "crashing") return { status: state, restartCount: 0, exitCode, startedAt, finishedAt };
  const since = startedAt ?? clock;
  const max = container.restart.name === "on-failure" ? container.restart.maximumRetryCount : 0;
  const { count, spent } = restartsWithin(clock - since, max);
  const code = container.last?.exitCode ?? exitCode;
  // on-failure:N은 N번 재시도한 뒤 멈춘다. always·unless-stopped는 계속 다시 뜬다.
  const gaveUp = max > 0 && count >= max;
  return { status: gaveUp ? "exited" : "restarting", restartCount: count, exitCode: code, startedAt: since + spent, finishedAt: since + spent };
}

/** 지금까지 실행된 횟수(이번 시작 이후 재시작 포함). */
export function totalRuns(container: DockerContainer, clock: number): number {
  if (container.state === "running") return container.pastRuns + 1;
  if (container.state === "crashing") return container.pastRuns + 1 + containerView(container, clock).restartCount;
  return container.pastRuns;
}

export function findImage(docker: DockerState, ref: string): DockerImage | undefined {
  const [repository, tag = "latest"] = splitRef(ref);
  return docker.images.find(i => (i.repository === repository && i.tag === tag) || (ref.length >= 4 && i.id.startsWith(ref)));
}

/** "shop-api:2.1.0" → ["shop-api", "2.1.0"]. 레지스트리 포트(host:5000/app)의 콜론은 태그로 보지 않는다. */
export function splitRef(ref: string): [string, string | undefined] {
  const slash = ref.lastIndexOf("/");
  const colon = ref.lastIndexOf(":");
  return colon > slash ? [ref.slice(0, colon), ref.slice(colon + 1)] : [ref, undefined];
}

/** 이름, 전체 ID, ID 앞부분 어느 것으로도 찾는다(실제 docker와 같다). */
export function findContainer(docker: DockerState, key: string): DockerContainer | undefined {
  const name = key.replace(/^\//, "");
  return docker.containers.find(c => c.name === name) ?? docker.containers.find(c => c.id.startsWith(key));
}

/** 이미지 기본값 위에 컨테이너 값을 얹은 실제 환경 변수 */
export function mergedEnv(container: DockerContainer, image: DockerImage | undefined): Record<string, string> {
  return { ...container.env, ...Object.fromEntries(Object.entries(image?.env ?? {}).filter(([key]) => !(key in container.env))) };
}

export function runSpec(container: DockerContainer, image: DockerImage | undefined): RunSpec {
  return { env: mergedEnv(container, image) };
}

/** docker logs: 같은 설정으로 실행할 때마다 같은 로그가 이어 붙는다. 반복 종료면 FATAL 줄이 여러 번 보인다. */
export function containerLogs(docker: DockerState, container: DockerContainer, clock: number): string[] {
  const image = docker.images.find(i => i.id === container.imageId);
  if (!image) return [];
  const once = runLog(runSpec(container, image), image.profile);
  return Array.from({ length: totalRuns(container, clock) }, () => once).flat();
}

/**
 * docker-proxy로 들어온 요청에 컨테이너가 답한다. 이미지에 적힌 경로별 응답을 쓰고, 없는 경로는 404.
 * 컨테이너가 이미 없거나 실행 중이 아니면 프록시가 연결을 끊는다.
 */
export function containerResponse(docker: DockerState | undefined, id: string, path: string, clock: number): { status: number; body: string; headers: Record<string, string> } | null {
  const container = docker?.containers.find(c => c.id === id);
  if (!container || containerView(container, clock).status !== "running") return null;
  const image = docker!.images.find(i => i.id === container.imageId);
  const body = image?.profile.responses?.[path.split("?")[0]];
  const headers = image?.profile.headers ?? { "Content-Type": "application/json; charset=utf-8" };
  return body === undefined ? { status: 404, body: '{"error":"not found"}', headers } : { status: 200, body, headers };
}
