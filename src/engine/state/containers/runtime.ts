/**
 * 컨테이너 한 번의 실행이 어떻게 끝나는지 계산한다. K8s(kubernetes/runtime.ts)와 Docker(docker/runtime.ts)가 함께 쓴다.
 * 시나리오는 이미지·설정만 정하고, 종료 이유·종료 코드·로그는 모두 여기서 나온다.
 */
import type { ImageProfile, RunSpec, TerminatedState } from "./types";

export type RunOutcome =
  | { kind: "crash"; last: TerminatedState; missingEnv?: string }
  | { kind: "run" };

/** 판정 순서: 설정 검사는 메모리를 크게 쓰기 전(시작 직후)에 실패한다. */
export function runOutcome(spec: RunSpec, image: ImageProfile): RunOutcome {
  const missingEnv = image.requiredEnv?.find(name => !spec.env?.[name]);
  if (missingEnv) return { kind: "crash", last: { reason: "Error", exitCode: 1 }, missingEnv };
  const limit = spec.memoryLimitMi;
  if (image.memoryMi !== undefined && limit !== undefined && image.memoryMi > limit) {
    // 137 = 128 + SIGKILL(9). 커널(cgroup)이 강제로 죽이므로 앱은 마지막 오류를 남기지 못한다.
    return { kind: "crash", last: { reason: "OOMKilled", exitCode: 137 } };
  }
  return { kind: "run" };
}

/** 한 번 실행했을 때의 로그. 설정 오류는 원인을 한 줄 남기고, OOM은 아무 말 없이 끊긴다. */
export function runLog(spec: RunSpec, image: ImageProfile): string[] {
  const boot = image.log?.boot ?? [];
  const result = runOutcome(spec, image);
  if (result.kind === "crash" && result.missingEnv) {
    return [...boot, `FATAL config: required environment variable ${result.missingEnv} is not set`];
  }
  if (result.kind === "crash") return boot;
  return [...boot, ...(image.log?.ready ?? [])];
}
