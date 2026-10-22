/**
 * 튜토리얼: 주소(#/tutorial), 코치 마크 단계 계산(직접 해야 넘어가는 단계·"다음" 단계·화면별), "봤음" 저장.
 * 연습 실습 자체의 풀이·탐색 검증은 scenarios.test.ts·scenario-exploration.test.ts가 함께 한다.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSession, submitCause, type Session } from "../src/engine/session/session";
import { execute } from "../src/engine/session/execute";
import { scenarios } from "../src/scenarios";
import { tutorialScenario } from "../src/scenarios/tutorial-first-shift";
import { missionCode, missionNumber, scenarioByNumber } from "../src/ui/missionCode";
import { formatRoute, parseRoute, TUTORIAL_NO } from "../src/ui/route";
import { currentStep, TUTORIAL_STEPS } from "../src/ui/tutorial/steps";
import { loadTutorialDone, saveTutorialDone } from "../src/ui/tutorial/tutorialPrefs";

const run = (session: Session, ...inputs: string[]) => inputs.reduce((s, input) => execute(s, input), session);
const ids = (stage: "briefing" | "play" | "report", session: Session | null, ack: string[] = []) => currentStep(stage, session, new Set(ack))?.id ?? null;

describe("튜토리얼 주소와 번호", () => {
  it("#/tutorial은 0번 실습이고, 단계 주소가 오간다", () => {
    expect(parseRoute("#/tutorial", scenarios.length)).toEqual({ kind: "mission", no: TUTORIAL_NO, stage: "briefing" });
    expect(parseRoute("#/tutorial/play", scenarios.length)).toEqual({ kind: "mission", no: TUTORIAL_NO, stage: "play" });
    expect(formatRoute({ kind: "mission", no: TUTORIAL_NO, stage: "report" })).toBe("#/tutorial/report");
    expect(parseRoute("#/tutorial/hack", scenarios.length)).toEqual({ kind: "home" });
    expect(parseRoute("#/mission/0", scenarios.length)).toEqual({ kind: "home" });
  });

  it("튜토리얼은 번호 0·TUTORIAL로, 실습은 제 번호로 보인다", () => {
    expect(scenarioByNumber(TUTORIAL_NO)).toBe(tutorialScenario);
    expect(missionNumber(tutorialScenario)).toBe(0);
    expect(missionCode(tutorialScenario)).toBe("TUTORIAL");
    expect(missionCode(scenarios[4])).toBe("05");
    expect(scenarioByNumber(1)).toBe(scenarios[0]);
  });
});

describe("코치 마크 단계", () => {
  it("브리핑에서는 티켓 안내, 다음을 누르면 숨는다", () => {
    expect(ids("briefing", null)).toBe("ticket");
    expect(ids("briefing", null, ["ticket"])).toBeNull();
  });

  it("터미널 단계는 명령을 실제로 쳐야 넘어간다(sudo를 붙여도 같다)", () => {
    let session = createSession(tutorialScenario);
    expect(ids("play", session)).toBe("help");
    session = run(session, "help");
    expect(ids("play", session)).toBe("status");
    session = run(session, "sudo systemctl status nginx");
    expect(ids("play", session)).toBe("journal");
    session = run(session, "journalctl -u nginx");
    expect(ids("play", session)).toBe("help-tools");
    expect(ids("play", session, ["help-tools"])).toBe("cause");
  });

  it("원인을 맞히면 조치 단계, 복구하면 이 화면의 말풍선이 끝난다", () => {
    let session = run(createSession(tutorialScenario), "help", "systemctl status nginx", "journalctl -u nginx");
    session = submitCause(session, "crashed").session;
    expect(ids("play", session, ["help-tools"])).toBe("cause");
    session = submitCause(session, tutorialScenario.rootCause.answerId).session;
    expect(ids("play", session, ["help-tools"])).toBe("fix");
    session = run(session, "sudo systemctl start nginx");
    expect(ids("play", session, ["help-tools"])).toBeNull();
    expect(ids("report", session)).toBe("postmortem");
  });

  it("단계마다 대상·제목·설명이 있고, 마지막은 리포트의 포스트모템이다", () => {
    for (const step of TUTORIAL_STEPS) {
      expect(step.target.length).toBeGreaterThan(1);
      expect(step.title.length).toBeGreaterThan(3);
      expect(step.body.length).toBeGreaterThan(20);
    }
    expect(TUTORIAL_STEPS.at(-1)?.stage).toBe("report");
    // 말풍선이 시키는 명령은 튜토리얼 모범 풀이에 실제로 있다(오타 방지).
    for (const step of TUTORIAL_STEPS.filter(s => s.command)) expect(tutorialScenario.solutionPath).toContain(step.command);
  });
});

describe("튜토리얼을 봤다는 표시", () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it("저장하면 다음에 '봤음'이고, 저장소가 막혀도 오류 없이 '안 봤음'", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    expect(loadTutorialDone()).toBe(false);
    saveTutorialDone();
    expect(loadTutorialDone()).toBe(true);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(loadTutorialDone()).toBe(false);
    expect(() => saveTutorialDone()).not.toThrow();
  });
});
