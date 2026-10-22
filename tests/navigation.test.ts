import { describe, expect, it } from "vitest";
import { formatRoute, parseRoute, type Route } from "../src/ui/route";
import { serializeSession } from "../src/ui/sessionStore";
import { restoreSession } from "../src/ui/sessionReplay";
import { createSession, revealHint, submitCause } from "../src/engine/session/session";
import { execute } from "../src/engine/session/execute";
import { scenarios } from "../src/scenarios";

describe("해시 라우트", () => {
  const routes: Route[] = [
    { kind: "home" }, { kind: "knowledge" }, { kind: "records" },
    { kind: "mission", no: 1, stage: "briefing" }, { kind: "mission", no: 13, stage: "play" }, { kind: "mission", no: 2, stage: "report" },
  ];
  it.each(routes)("주소로 바꿨다가 되읽으면 같다: %o", route => {
    expect(parseRoute(formatRoute(route), 13)).toEqual(route);
  });
  it.each(["", "#", "#/unknown", "#/mission/0", "#/mission/14", "#/mission/x", "#/mission/1/hack", "#/mission/1/play/extra"])(
    "모르는 주소 %s 는 홈으로", hash => expect(parseRoute(hash, 13)).toEqual({ kind: "home" }));
  it("주소에 시나리오 ID(원인 노출)를 쓰지 않는다", () => {
    expect(formatRoute({ kind: "mission", no: 1, stage: "play" })).toBe("#/mission/1/play");
  });
});

describe("진행 중 실습 저장·복원", () => {
  const scenario = scenarios[0];
  it("입력한 명령을 다시 실행해 화면·상태가 그대로 돌아온다", () => {
    let session = createSession(scenario, 1_000);
    for (const step of scenario.solutionPath.slice(0, 3)) session = execute(session, step, 2_000);
    session = revealHint(session);
    const wrong = scenario.rootCause.choices.find(c => c.id !== scenario.rootCause.answerId)!;
    session = submitCause(session, wrong.id, 3_000).session;

    const restored = restoreSession(JSON.parse(JSON.stringify(serializeSession(session))), scenarios)!;
    expect(restored.lines).toEqual(session.lines);
    expect(restored.state).toEqual(session.state);
    expect(restored.hintsUsed).toBe(1);
    expect(restored.wrongAnswers).toEqual([wrong.id]);
    expect(restored.startedAt).toBe(1_000);
  });

  it("클리어한 실습은 완료 시각과 원인 규명까지 복원한다", () => {
    let session = createSession(scenario, 1_000);
    for (const step of scenario.solutionPath) session = execute(session, step, 2_000);
    session = submitCause(session, scenario.rootCause.answerId, 5_000).session;
    const restored = restoreSession(serializeSession(session), scenarios)!;
    expect(restored.causeSolved).toBe(true);
    expect(restored.finishedAt).toBe(session.finishedAt);
    expect(scenario.resolution(restored.state)).toBe(true);
  });

  it.each([null, {}, { scenarioId: "없는-시나리오", startedAt: 1, inputs: [], hintsUsed: 0, wrongAnswers: [], causeSolved: false }, { scenarioId: scenario.id, inputs: "ls" }])(
    "손상된 저장본은 버린다", saved => expect(restoreSession(saved, scenarios)).toBeNull());
});
