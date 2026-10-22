/**
 * 안정성: 모든 실습의 모든 명령에 이상한 입력을 넣어도 엔진이 예외로 멈추지 않는다.
 * 결과는 실제 셸처럼 오류 문장·종료 코드로 나와야 하고, undefined·NaN 같은 내부 값이 화면에 새면 안 된다.
 */
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_COMMANDS } from "../src/engine/commands";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { scenarios } from "../src/scenarios";

const ARGS = [
  "", "-", "--", "-z", "--nope", "''", "\"\"", "/", "/proc", "/proc/1", "/proc/sys/fs", "/nonexistent", ".", "..", "*", "-1", "0",
  "999999999999999999999", "NaN", "한글", "a=b", "=", ":", ":::", "x:y:z", "../../etc/passwd", "-n -1", "-n abc", "-p", "-i :", "--tail=-5",
  "x".repeat(500), "status", "get", "logs", "set", "rollout", "patch", "run", "inspect", "-f '{{.Nope}}'", "--format '{{json .}}'",
  "describe pod", "get pods -l", "ec2 describe-instances", "s_client -connect", "x509 -in", "-e", "-t", "-T", "-s", "reload", "show -p",
];

describe("이상한 입력에도 엔진이 멈추지 않는다", () => {
  for (const scenario of scenarios) {
    it(scenario.id, () => {
      const available = scenario.commands ?? DEFAULT_COMMANDS;
      let state = buildInitialState(scenario);
      for (const name of available) {
        for (const args of ARGS) {
          for (const line of [`${name} ${args}`, `sudo ${name} ${args}`]) {
            let result;
            try {
              result = runCommand(state, line, { available });
            } catch (error) {
              throw new Error(`${scenario.id}: "${line.slice(0, 80)}" → ${(error as Error).stack?.split("\n").slice(0, 3).join(" | ")}`);
            }
            expect(typeof result.stdout, line).toBe("string");
            expect(Number.isInteger(result.exitCode), line).toBe(true);
            // 입력에 그 글자가 있으면 실제 셸처럼 되풀이해 보여 줄 수 있으므로 검사에서 뺀다.
            if (!/undefined|NaN|object|\*/.test(line)) expect(result.stdout + result.stderr, line).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/);
            state = result.state;
          }
        }
      }
    });
  }
});

describe("명령 구현에 버그가 있어도 실습 화면은 계속된다", () => {
  it("명령이 예외를 던지면 시뮬레이터 오류로 알리고 상태는 그대로 둔다", async () => {
    const { getCommand } = await import("../src/engine/commands");
    const ls = getCommand("ls")!;
    const original = ls.run;
    ls.run = () => { throw new Error("boom"); };
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const state = buildInitialState(scenarios[0]);
      const result = runCommand(state, "ls /", { available: DEFAULT_COMMANDS });
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("ls: [시뮬레이터 오류] 이 명령을 처리하다 문제가 생겼습니다. 다른 명령으로 계속할 수 있어요.");
      expect(result.state).toEqual(state);
      expect(quiet).toHaveBeenCalledOnce();
    } finally {
      ls.run = original;
      quiet.mockRestore();
    }
  });
});
