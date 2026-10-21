/**
 * 모든 시나리오를 자동 검증한다.
 *
 * 이 테스트가 깨지면 "풀 수 없는 시나리오"가 들어왔다는 뜻이다.
 * 시나리오를 추가할 때 따로 테스트를 쓸 필요 없이 여기서 자동으로 검사된다.
 */
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { DEFAULT_COMMANDS, getCommand } from "../src/engine/commands";
import { scenarios } from "../src/scenarios";
import { isCategory } from "../src/engine";
import type { SystemState } from "../src/engine/state/types";

/** 모범 풀이에 절대 나오면 안 되는 실패 신호들. 오타나 잘못된 경로를 잡아낸다. */
const FAILURE_SIGNS = [
  "command not found",
  "No such file or directory",
  "Permission denied",
  "missing operand",
  "Unknown operation",
  "could not be found",
  "지원하지 않습니다",
];

describe("시나리오 데이터 스키마", () => {
  it("시나리오 id가 중복되지 않는다", () => {
    const ids = scenarios.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(scenarios)("$id 의 필수 항목이 채워져 있다", (scenario) => {
    expect(scenario.title.length).toBeGreaterThan(0);
    expect(scenario.ticket.length).toBeGreaterThan(20);
    expect(scenario.learningObjectives.length).toBeGreaterThan(0);
    expect(scenario.hints).toHaveLength(3);
    scenario.hints.forEach((hint) => expect(hint.length).toBeGreaterThan(10));
    expect(scenario.solutionPath.length).toBeGreaterThan(0);
    expect(scenario.faults.length).toBeGreaterThan(0);
  });

  it.each(scenarios)("$id 의 정답이 보기 안에 있고, 오답에는 해설이 있다", (scenario) => {
    const { choices, answerId } = scenario.rootCause;
    expect(choices.length).toBeGreaterThanOrEqual(3);
    expect(choices.map((c) => c.id)).toContain(answerId);
    // 오답 보기는 "왜 아닌지"를 반드시 설명해야 한다 (교육용이므로)
    for (const choice of choices.filter((c) => c.id !== answerId)) {
      expect(choice.whyWrong, `${choice.id} 에 whyWrong 이 없습니다`).toBeTruthy();
    }
  });

  it.each(scenarios)("$id 의 포스트모템에 재발 방지책이 있다", (scenario) => {
    expect(scenario.postmortem.howToPrevent.length).toBeGreaterThan(20);
  });

  // "실제로 자주 일어나는 장애인가"를 데이터로 남긴다. 3자 블로그만으로는 부족하고 공식 문서나 공개 포스트모템이 있어야 한다.
  it.each(scenarios)("$id 에 실제 근거 자료가 있다", (scenario) => {
    expect(scenario.evidence.length).toBeGreaterThan(0);
    for (const item of scenario.evidence) {
      expect(["official-doc", "postmortem", "survey"]).toContain(item.kind);
      expect(item.title.length).toBeGreaterThan(3);
      expect(new URL(item.url).protocol, item.url).toBe("https:");
    }
    expect(scenario.evidence.some((item) => item.kind !== "survey"), "공식 문서나 포스트모템이 하나 이상 필요합니다").toBe(true);
  });

  it.each(scenarios)("$id 의 분류가 엔진 분류 목록에 있다", (scenario) => {
    expect(isCategory(scenario.category), scenario.category).toBe(true);
  });

  it.each(scenarios)("$id 이 쓰는 명령어가 모두 등록되어 있다", (scenario) => {
    for (const name of scenario.commands ?? DEFAULT_COMMANDS) {
      expect(getCommand(name), `${name} 명령어가 레지스트리에 없습니다`).toBeDefined();
    }
  });
});

describe("시나리오 플레이 가능성", () => {
  it.each(scenarios)("$id 은 장애 주입 직후에는 복구되지 않은 상태다", (scenario) => {
    const state = buildInitialState(scenario);
    expect(scenario.resolution(state)).toBe(false);
  });

  it.each(scenarios)("$id 은 모범 풀이대로 하면 복구된다", (scenario) => {
    let state: SystemState = buildInitialState(scenario);

    for (const input of scenario.solutionPath) {
      const result = runCommand(state, input, { available: scenario.commands });
      state = result.state;

      // 모범 풀이의 명령이 "없는 명령어"거나 "없는 파일"을 가리키면 시나리오가 잘못된 것이다
      expect(result.exitCode, `'${input}' 이 127(command not found)로 끝났습니다`).not.toBe(127);
      for (const sign of FAILURE_SIGNS) {
        expect(result.stderr, `'${input}' 의 결과에 "${sign}" 가 있습니다:\n${result.stderr}`).not.toContain(sign);
      }
    }

    expect(scenario.resolution(state), "모범 풀이를 다 실행했는데도 복구 판정이 false 입니다").toBe(true);
  });
});
