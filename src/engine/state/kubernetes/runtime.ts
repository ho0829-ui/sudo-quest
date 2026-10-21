/**
 * 컨테이너 하나가 "어떻게 되는지"를 이미지 정보와 컨테이너 설정에서 계산한다.
 * 시나리오는 이미지·설정만 정하고, 상태·종료 이유·로그·재시작 횟수는 모두 여기서 나온다.
 */
import type { ContainerSpec, ImageProfile, KubeContainer, TerminatedState } from "./types";

export type Outcome =
  | { kind: "pull" }
  | { kind: "crash"; last: TerminatedState; missingEnv?: string }
  | { kind: "run" };

/** 판정 순서: 이미지가 없으면 시작조차 못 하고, 설정 검사는 메모리를 크게 쓰기 전(시작 직후)에 실패한다. */
export function outcome(spec: ContainerSpec, image: ImageProfile | undefined): Outcome {
  if (!image) return { kind: "pull" };
  const missingEnv = image.requiredEnv?.find(name => !spec.env?.[name]);
  if (missingEnv) return { kind: "crash", last: { reason: "Error", exitCode: 1 }, missingEnv };
  const limit = spec.resources?.limits?.memoryMi;
  if (image.memoryMi !== undefined && limit !== undefined && image.memoryMi > limit) {
    // 137 = 128 + SIGKILL(9). 커널(cgroup)이 강제로 죽이므로 앱은 마지막 오류를 남기지 못한다.
    return { kind: "crash", last: { reason: "OOMKilled", exitCode: 137 } };
  }
  return { kind: "run" };
}

/**
 * 반복 종료 중인 컨테이너의 재시작 횟수. 첫 실패 직후 1번, 이후 10초부터 두 배씩 늘어 최대 300초 간격(CrashLoopBackOff).
 * 상태에 숫자를 쌓지 않고 시각으로 계산해, 같은 상태를 다시 계산해도 결과가 같다.
 */
export function restartsSince(since: number, clock: number): number {
  const elapsed = Math.max(0, (clock - since) / 1000);
  let restarts = 1;
  let spent = 0;
  for (let delay = 10; spent + delay <= elapsed; delay = Math.min(delay * 2, 300)) {
    spent += delay;
    restarts++;
  }
  return restarts;
}

export function effectiveRestarts(container: KubeContainer, clock: number): number {
  return container.restartCount + (container.crashingSince === undefined ? 0 : restartsSince(container.crashingSince, clock));
}

/** 한 번 실행했을 때의 로그. 설정 오류는 원인을 한 줄 남기고, OOM은 아무 말 없이 끊긴다. */
export function runLog(spec: ContainerSpec, image: ImageProfile): string[] {
  const boot = image.log?.boot ?? [];
  const result = outcome(spec, image);
  if (result.kind === "crash" && result.missingEnv) {
    return [...boot, `FATAL config: required environment variable ${result.missingEnv} is not set`];
  }
  if (result.kind === "crash") return boot;
  return [...boot, ...(image.log?.ready ?? [])];
}

export function formatMemory(mi: number): string {
  return mi % 1024 === 0 ? `${mi / 1024}Gi` : `${Math.round(mi)}Mi`;
}

const UNITS: Record<string, number> = {
  "": 1 / (1024 * 1024), Ki: 1 / 1024, Mi: 1, Gi: 1024, Ti: 1024 * 1024,
  k: 1000 / (1024 * 1024), M: 1e6 / (1024 * 1024), G: 1e9 / (1024 * 1024),
};

/** Kubernetes 수량(512Mi, 1Gi, 500M, 268435456)을 MiB로. 형식이 틀리거나 0 이하면 undefined. */
export function parseMemory(value: string): number | undefined {
  const match = /^([0-9]+(?:\.[0-9]+)?)(Ki|Mi|Gi|Ti|k|M|G)?$/.exec(value);
  if (!match) return undefined;
  const mi = Number(match[1]) * UNITS[match[2] ?? ""];
  return mi > 0 ? mi : undefined;
}
