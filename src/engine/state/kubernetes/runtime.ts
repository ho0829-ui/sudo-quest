/**
 * 파드 컨테이너가 "어떻게 되는지"를 계산한다. 한 번의 실행 결과는 Docker와 같은 규칙(containers/runtime.ts)을 쓰고,
 * 여기서는 이미지 받기 실패와 CrashLoopBackOff 재시작 횟수처럼 Kubernetes에만 있는 부분을 더한다.
 */
import { runLog as containerRunLog, runOutcome, type RunOutcome } from "../containers/runtime";
import type { RunSpec } from "../containers/types";
import type { ContainerSpec, ImageProfile, KubeContainer } from "./types";

export type Outcome = { kind: "pull" } | RunOutcome;

function runSpec(spec: ContainerSpec): RunSpec {
  return { env: spec.env, memoryLimitMi: spec.resources?.limits?.memoryMi };
}

/** 이미지가 없으면 시작조차 못 한다. 그 밖에는 공통 실행 규칙을 따른다. */
export function outcome(spec: ContainerSpec, image: ImageProfile | undefined): Outcome {
  return image ? runOutcome(runSpec(spec), image) : { kind: "pull" };
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

/** 한 번 실행했을 때의 로그. */
export function runLog(spec: ContainerSpec, image: ImageProfile): string[] {
  return containerRunLog(runSpec(spec), image);
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
