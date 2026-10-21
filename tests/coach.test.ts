import { describe, expect, it } from "vitest";
import { buildCoachRequest, clip, MAX_OBSERVATIONS } from "../src/api/coach";
import { createSession, execute, revealHint } from "../src/engine/session/session";
import { scenarios } from "../src/scenarios";

const T0 = 1_000_000_000_000;
const ALLOWED_KEYS = [
  "available_commands", "command_operations", "history", "item_id", "observations", "omitted_observations",
  "question", "revealed_hints", "session_id", "ticket",
].sort();

/** 코치 요청에 절대 나오면 안 되는 비공개 문자열. 이미 공개된 티켓·힌트에 들어 있는 문자열은 뺀다. */
function secrets(scenario: (typeof scenarios)[number], publicText: string): string[] {
  const values = [
    scenario.id, scenario.title, scenario.rootCause.answerId,
    ...scenario.rootCause.choices.flatMap(c => [c.label, c.whyWrong ?? ""]),
    ...scenario.learningObjectives,
    ...Object.values(scenario.postmortem),
    // 근거 자료 제목(예: "bind(2) — EADDRINUSE")과 주소도 원인을 드러내므로 보내지 않는다.
    ...scenario.evidence.flatMap(e => [e.title, e.url]),
  ];
  return values.filter(v => typeof v === "string" && v.length >= 6 && !publicText.includes(v));
}

describe("코치 요청은 공개 정보만 담는다", () => {
  for (const scenario of scenarios) {
    it(`${scenario.id}: 정답·풀이·학습 목표·포스트모템·근거 자료·미공개 힌트가 없다`, () => {
      let session = createSession(scenario, T0);
      session = revealHint(session);
      session = execute(session, scenario.solutionPath[0], T0);
      const request = buildCoachRequest(session, "test-session-1", "다음에 뭘 볼까요?", null, []);
      const json = JSON.stringify(request);

      expect(Object.keys(request).sort()).toEqual(ALLOWED_KEYS);
      expect(request.revealed_hints).toEqual([scenario.hints[0]]);
      for (const hidden of scenario.hints.slice(1)) expect(json).not.toContain(hidden);
      // 아직 입력하지 않은 모범 풀이 명령은 들어가면 안 된다.
      for (const step of scenario.solutionPath.slice(1)) {
        if (step !== scenario.solutionPath[0]) expect(request.observations.map(o => o.command)).not.toContain(step);
      }
      const publicText = scenario.ticket + scenario.hints[0] + JSON.stringify(request.observations);
      const hidden = secrets(scenario, publicText);
      expect(hidden.length).toBeGreaterThan(5); // 검사할 비공개 문자열이 실제로 있는지(빈 검사 방지)
      for (const secret of hidden) expect(json).not.toContain(secret);
      expect(json).not.toContain("faults");
      expect(json).not.toContain("solutionPath");
    });
  }
});

describe("관찰 기록 정리", () => {
  it("긴 출력은 앞뒤를 남기고 생략 범위를 표시한다", () => {
    const text = "HEAD-" + "x".repeat(10_000) + "-TAIL";
    const result = clip(text, 4000);
    expect(result.truncated).toBe(true);
    expect(result.text.length).toBeLessThanOrEqual(4000);
    expect(result.text.startsWith("HEAD-")).toBe(true);
    expect(result.text.endsWith("-TAIL")).toBe(true);
    expect(result.text).toMatch(/중간 \d+자 생략/);
  });

  it("최근 기록만 보내고 몇 개를 뺐는지 알린다", () => {
    let session = createSession(scenarios[0], T0);
    for (let i = 0; i < MAX_OBSERVATIONS + 5; i++) session = execute(session, "pwd", T0);
    const request = buildCoachRequest(session, "test-session-1", "q", null, []);
    expect(request.observations).toHaveLength(MAX_OBSERVATIONS);
    expect(request.omitted_observations).toBe(5);
  });
});
