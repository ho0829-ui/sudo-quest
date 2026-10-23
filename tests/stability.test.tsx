/**
 * 웹페이지 안정성: 모든 실습의 화면이 그려지는지, 주소·저장소·서버 응답이 이상해도 버티는지, 긴 실습이 느려지지 않는지.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { isAnswer, isCoachAnswer, isExploreResult, isItems } from "../src/api/validate";
import { execute } from "../src/engine/session/execute";
import { createSession, isCleared, submitCause } from "../src/engine/session/session";
import { scenarios } from "../src/scenarios";
import { ErrorBoundary, isChunkLoadError } from "../src/ui/components/ErrorBoundary";
import { randomId } from "../src/ui/randomId";
import { formatRoute, parseRoute } from "../src/ui/route";
import { PlayScreen } from "../src/ui/screens/PlayScreen";
import { ReportScreen } from "../src/ui/screens/ReportScreen";
import { ScenarioList } from "../src/ui/screens/ScenarioList";
import { TicketScreen } from "../src/ui/screens/TicketScreen";
import { restoreSession } from "../src/ui/sessionReplay";
import { readSavedSession, saveActiveSession, serializeSession } from "../src/ui/sessionStore";
import { loadProgress, saveClear } from "../src/ui/storage";
import { sanitizeTurns } from "../src/ui/useStoredState";

/** 브라우저 저장소 흉내. throwOn을 주면 그 동작에서 예외를 던진다(시크릿 모드·용량 초과). */
function fakeStorage(throwOn?: "get" | "set") {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => { if (throwOn === "get") throw new Error("SecurityError"); return data.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (throwOn === "set") throw new DOMException("quota", "QuotaExceededError"); data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

beforeAll(() => {
  // 캠퍼스는 터치 화면인지 matchMedia로 본다. 노드 환경에는 없으므로 흉내만 낸다.
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { hash: "" } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { hash: "" } }); });

const noop = () => {};

describe("모든 실습의 화면이 그려진다", () => {
  for (const [index, scenario] of scenarios.entries()) {
    it(`${index + 1}. ${scenario.id}: 브리핑 → 실습(풀기 전·후) → 리포트`, () => {
      expect(renderToStaticMarkup(<TicketScreen scenario={scenario} motion={false} onStart={noop} onBack={noop} />)).toContain(scenario.title.replace(/'/g, "&#x27;"));
      let session = createSession(scenario, 0);
      const play = (s: typeof session) => renderToStaticMarkup(<PlayScreen session={s} onUpdate={noop} onRevealHint={noop} onSubmitCause={() => ({ correct: false })} onGiveUp={noop} />);
      expect(play(session)).toContain("bash");
      for (const line of scenario.solutionPath) session = execute(session, line, 0);
      session = submitCause(session, scenario.rootCause.answerId, 0).session;
      expect(isCleared(session)).toBe(true);
      expect(play(session)).toContain("bash");
      expect(renderToStaticMarkup(<ReportScreen session={session} onBackToList={noop} onRetry={noop} onShare={noop} />)).toContain("포스트모템");
    });
  }

  it("학습 기록이 비었거나 전부 풀었어도 실습 목록이 그려진다", () => {
    const all = Object.fromEntries(scenarios.map(s => [s.id, { cleared: true, bestScore: 1000, clearedAt: 1 }]));
    for (const progress of [{}, all]) {
      const html = renderToStaticMarkup(<ScenarioList scenarios={scenarios} progress={progress} onSelect={noop} onResetProgress={noop} onExplore={noop} onOpenRecords={noop} onCommunity={noop} />);
      expect(html.length).toBeGreaterThan(1000);
    }
  });
});

describe("화면 오류 안내", () => {
  it("배포 직후 조각 파일을 못 받은 오류를 구분한다", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/PlayScreen-1.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Cannot read properties of undefined"))).toBe(false);
  });

  it("오류가 나면 흰 화면 대신 안내와 다시 시도·새로고침 버튼을 그린다", () => {
    const render = (error: Error, compact = false) => {
      const boundary = new ErrorBoundary({ label: "실습 화면", compact, children: null });
      boundary.state = ErrorBoundary.getDerivedStateFromError(error);
      return renderToStaticMarkup(<>{boundary.render()}</>);
    };
    const crash = render(new Error("boom"));
    expect(crash).toContain('role="alert"');
    expect(crash).toContain("실습 화면에서 오류가 났어요");
    expect(crash).toContain("다시 시도");
    expect(crash).not.toContain("boom");
    expect(render(new TypeError("Importing a module script failed."))).toContain("새로고침");
    expect(render(new Error("x"), true)).not.toContain("홈으로");
  });
});

describe("이상한 주소", () => {
  it.each(["", "#", "#/", "#//", "#/mission", "#/mission/0", "#/mission/25", "#/mission/01e1", "#/mission/1/report/x",
    "#/mission/-1", "#/mission/1.5", "#/community/abc", "#/community/0", "#/community/1/2", "#/community/write/999",
    "#/knowledge/x", "#/%E2%9C%93", "#/" + "a/".repeat(500), "#/mission/99999999999999999999"])("%s", (hash) => {
    const route = parseRoute(hash, scenarios.length);
    // 어떤 주소든 화면 종류 하나로 정해지고, 다시 주소로 만들어도 같은 화면이다.
    expect(parseRoute(formatRoute(route), scenarios.length)).toEqual(route);
    if (route.kind === "mission") expect(route.no).toBeGreaterThanOrEqual(1);
  });
});

describe("저장소가 막히거나 손상돼도", () => {
  it("학습 기록: 읽기가 막히면 빈 기록, 쓰기가 막혀도 이번 판 결과는 돌려준다", () => {
    vi.stubGlobal("localStorage", fakeStorage("get"));
    expect(loadProgress()).toEqual({});
    vi.stubGlobal("localStorage", fakeStorage("set"));
    expect(saveClear("linux-disk-full", 900)["linux-disk-full"]).toMatchObject({ cleared: true, bestScore: 900 });
    const broken = fakeStorage();
    broken.setItem("incident-game/v1", "{not json");
    vi.stubGlobal("localStorage", broken);
    expect(loadProgress()).toEqual({});
  });

  it("진행 중 실습: 용량 초과에도 예외 없이 넘어가고, 손상된 저장본은 무시한다", () => {
    vi.stubGlobal("sessionStorage", fakeStorage("set"));
    expect(() => saveActiveSession(createSession(scenarios[0], 0))).not.toThrow();
    const broken = fakeStorage();
    broken.setItem("incident-game/active-session", '{"scenarioId":1}');
    vi.stubGlobal("sessionStorage", broken);
    expect(readSavedSession()).toBeNull();
  });

  it("대화 기록: 모양이 다른 턴은 버리고, 결과만 깨졌으면 질문은 남긴다", () => {
    const good = { answer: "a", suggested_checks: [], citations: [], warnings: [], cache_hit: false };
    expect(sanitizeTurns("x", isAnswer)).toBeNull();
    expect(sanitizeTurns([42, null, { question: 1 }, { question: "q1", result: { answer: 3 } }, { question: "q2", result: good, error: 7 }], isAnswer))
      .toEqual([{ question: "q1" }, { question: "q2", result: good }]);
  });
});

describe("서버 응답 모양 검사", () => {
  it("답변·코치 답변·조건 탐색·항목 목록의 모양이 다르면 거절한다", () => {
    const answer = { answer: "a", suggested_checks: ["df -h"], warnings: [], cache_hit: true,
      citations: [{ evidence_id: 1, title: "t", text: "x", source_url: "u", source_type: "doc", publisher: "p", license: "l" }] };
    expect(isAnswer(answer)).toBe(true);
    expect(isAnswer({ ...answer, citations: [{ title: "t" }] })).toBe(false);
    expect(isCoachAnswer({ ...answer, observations: [{ observation_id: 1, command: "ls" }] })).toBe(true);
    expect(isCoachAnswer(answer)).toBe(false);
    expect(isExploreResult({ cards: [], applied_filters: { products: [], codes: [] }, candidate_count: 0, unverifiable_conditions: [], notes: [], cache_hit: false })).toBe(true);
    expect(isExploreResult({ cards: "x" })).toBe(false);
    expect(isItems({ items: [{ item_id: "a" }], index_ready: true })).toBe(false);
  });
});

describe("오래 쓰는 실습", () => {
  it("명령 300개를 실행·저장·복원해도 빠르고 같은 상태로 돌아온다", () => {
    const scenario = scenarios.find(s => s.id === "docker-disk-full")!;
    const commands = ["docker ps -a", "df -h", "docker system df", "ls -l /var/lib/docker", "journalctl -u docker -n 3", "docker images | head -n 3"];
    let session = createSession(scenario, 0);
    const start = performance.now();
    for (let i = 0; i < 300; i++) session = execute(session, commands[i % commands.length], 0);
    const elapsed = performance.now() - start;
    const saved = JSON.stringify(serializeSession(session));
    const restored = restoreSession(JSON.parse(saved), scenarios)!;
    expect(restored.lines.length).toBe(300);
    expect(restored.state).toEqual(session.state);
    expect(saved.length).toBeLessThan(20_000);
    // 개발 기계 기준 넉넉한 한도. 명령 하나가 수십 ms를 넘기면 화면이 끊겨 보인다.
    expect(elapsed / 300).toBeLessThan(50);
  });

  it("무작위 ID는 HTTPS가 아닌 곳(crypto.randomUUID 없음)에서도 UUID 모양이다", () => {
    vi.stubGlobal("crypto", { getRandomValues: (a: Uint8Array) => a.map((_, i) => (i * 37) & 255) });
    expect(randomId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
