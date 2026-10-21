import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { scenarios } from "../src/scenarios";
import { explorations } from "./scenario-exploration.cases";

const common = ["help", "pwd", "ls -lah /var/log", "df -h", "du -sh /var/log", "cat /etc/hosts", "journalctl --lines=2"];

describe("정답 경로 밖의 시나리오 탐색", () => {
  it("모든 시나리오에 독립적으로 작성한 탐색 사례가 있다", () => {
    expect(Object.keys(explorations).sort()).toEqual(scenarios.map(s => s.id).sort());
  });
  for (const scenario of scenarios) {
    const cases = explorations[scenario.id];
    it(`${scenario.id}: 조회 순서·반복은 시스템과 복구 판정을 바꾸지 않는다`, () => {
      let state = buildInitialState(scenario);
      const before = structuredClone(state);
      const commands = [...common, ...cases.inspect];
      // 정방향 뒤 역방향으로 다시 조회해 순서 의존이나 조회 부작용을 잡는다.
      for (const line of [...commands, ...[...commands].reverse()]) {
        const result = runCommand(state, line, { available: scenario.commands });
        expect(result.exitCode, line).not.toBe(127);
        expect(result.stderr, line).not.toMatch(/unrecognized|unknown options|unsupported|syntax error|invalid option/i);
        expect(result.stdout + result.stderr, line).not.toMatch(/\bundefined\b|\bNaN\b/);
        expect(result.state, line).toEqual(before);
        expect(scenario.resolution(result.state), line).toBe(false);
        state = result.state;
      }
    });
    it(`${scenario.id}: 무관하거나 틀린 조치로는 복구 판정이 나지 않는다`, () => {
      let state = buildInitialState(scenario);
      for (const line of cases.unrelated) {
        state = runCommand(state, line, { available: scenario.commands }).state;
        expect(scenario.resolution(state), line).toBe(false);
      }
    });
    it(`${scenario.id}: 별칭·다른 옵션·다른 조치로도 복구하고 다시 조회할 수 있다`, () => {
      let state = buildInitialState(scenario);
      for (const line of cases.alternative) {
        const result = runCommand(state, line, { available: scenario.commands });
        expect(result.exitCode, `${line}: ${result.stderr}`).toBe(0);
        state = result.state;
      }
      expect(scenario.resolution(state)).toBe(true);
      const fixed = structuredClone(state);
      for (const line of cases.inspect) {
        const result = runCommand(state, line, { available: scenario.commands });
        expect(result.state, line).toEqual(fixed);
        expect(scenario.resolution(result.state), line).toBe(true);
      }
    });
  }
});
