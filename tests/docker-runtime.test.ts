/** 가상 Docker 엔진의 계산 규칙: 재시작 정책 시간 계산, 시간 표기, K8s와 같은 실행 규칙. */
import { describe, expect, it } from "vitest";
import { commandOperations, supportsInvocation, withCommands } from "../src/engine/commands";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { humanDuration } from "../src/engine/state/docker/format";
import { containerView } from "../src/engine/state/docker/runtime";
import type { DockerContainer } from "../src/engine/state/docker/types";
import { runOutcome } from "../src/engine/state/containers/runtime";
import { dockerMissingEnv } from "../src/scenarios/docker-missing-env";

function crashing(policy: DockerContainer["restart"]): DockerContainer {
  return {
    id: "a".repeat(64), name: "c", image: "x", imageId: "b".repeat(64), cmd: [], createdAt: 0, env: {}, ports: [], restart: policy,
    state: "crashing", startedAt: 0, exitCode: 1, last: { reason: "Error", exitCode: 1 }, pastRuns: 0, manuallyStopped: false, error: "",
  };
}

describe("재시작 정책 시간 계산", () => {
  it("on-failure:5는 100ms부터 두 배 간격으로 다시 뜨다가 다섯 번 뒤 멈춘다", () => {
    const container = crashing({ name: "on-failure", maximumRetryCount: 5 });
    expect(containerView(container, 0)).toMatchObject({ status: "restarting", restartCount: 0 });
    expect(containerView(container, 1000)).toMatchObject({ status: "restarting", restartCount: 3 });
    expect(containerView(container, 60_000)).toMatchObject({ status: "exited", restartCount: 5, exitCode: 1, finishedAt: 3100 });
  });

  it("always는 간격 상한 1분으로 계속 다시 뜬다", () => {
    const container = crashing({ name: "always", maximumRetryCount: 0 });
    expect(containerView(container, 200_000)).toMatchObject({ status: "restarting", restartCount: 11 });
  });

  it("손으로 다시 시작하면 재시작 횟수가 0부터 다시 센다", () => {
    const scenario = dockerMissingEnv;
    let state = buildInitialState(scenario);
    expect(runCommand(state, "docker inspect -f '{{.RestartCount}}' notify-worker", { available: scenario.commands }).stdout).toBe("5");
    state = runCommand(state, "docker restart notify-worker", { available: scenario.commands }).state;
    const ps = runCommand(state, "docker ps", { available: scenario.commands }).stdout;
    expect(ps).toMatch(/Restarting \(1\) Less than a second ago +notify-worker/);
    expect(runCommand(state, "docker inspect -f '{{.RestartCount}}' notify-worker", { available: scenario.commands }).stdout).toBe("0");
  });
});

describe("docker 시간 표기", () => {
  it.each([
    [500, "Less than a second"], [1000, "1 second"], [45_000, "45 seconds"], [60_000, "About a minute"], [35 * 60_000, "35 minutes"],
    [3_600_000, "About an hour"], [86_400_000, "24 hours"], [6 * 86_400_000, "6 days"], [20 * 86_400_000, "2 weeks"], [120 * 86_400_000, "4 months"],
  ])("%d ms → %s", (ms, text) => expect(humanDuration(ms)).toBe(text));
});

describe("K8s와 같은 실행 규칙", () => {
  it("필수 환경 변수가 빠지면 종료 코드 1, 메모리 한도를 넘으면 OOMKilled 137", () => {
    const image = { ports: [], paths: [], requiredEnv: ["A"], memoryMi: 300 };
    expect(runOutcome({}, image)).toMatchObject({ kind: "crash", missingEnv: "A", last: { exitCode: 1 } });
    expect(runOutcome({ env: { A: "1" }, memoryLimitMi: 128 }, image)).toMatchObject({ kind: "crash", last: { reason: "OOMKilled", exitCode: 137 } });
    expect(runOutcome({ env: { A: "1" } }, image)).toEqual({ kind: "run" });
  });
});

describe("코치 제안용 docker 하위 명령", () => {
  const available = withCommands("docker");
  it("지원하는 하위 명령과 관리 명령 묶음 형태만 허용한다", () => {
    expect(commandOperations(available).docker).toEqual(expect.arrayContaining(["ps", "logs", "inspect", "run", "rm", "container ls"]));
    expect(supportsInvocation("docker run -d --name x -p 8080:8080 shop-api:2.1.0", available)).toBe(true);
    expect(supportsInvocation("docker container ls -a", available)).toBe(true);
    expect(supportsInvocation("docker compose up -d", available)).toBe(false);
    expect(supportsInvocation("docker exec -it web sh", available)).toBe(false);
  });
});
