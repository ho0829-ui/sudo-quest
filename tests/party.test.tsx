/**
 * 운영실 파티: 파티 여부 계산, 시작 연출을 봤다는 기록, 리포트 안내, 오픈 예정 실습, 방마다 파티 그림.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import type { Category, Scenario } from "../src/engine/scenario/types";
import { scenarios } from "../src/scenarios";
import { upcomingIn, upcomingScenarios } from "../src/scenarios/upcoming";
import { OPEN_CATEGORIES } from "../src/ui/categories";
import { celebrationKeys, clearSeen, loadSeen, markSeen, partyNotice, partyState, pendingParties } from "../src/ui/party";
import { clearProgress, type Progress } from "../src/ui/storage";
import { RoomArt } from "../src/ui/campus/art/RoomArt";
import { Person } from "../src/ui/campus/art/people";
import { PartyContext } from "../src/ui/campus/party/context";
import { ROOMS } from "../src/ui/campus/rooms";
import { createSession } from "../src/engine/session/session";
import { ReportScreen } from "../src/ui/screens/ReportScreen";
import { ScenarioList } from "../src/ui/screens/ScenarioList";

function fakeStorage(throwOn?: "get" | "set") {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => { if (throwOn === "get") throw new Error("SecurityError"); return data.get(k) ?? null; },
    setItem: (k: string, v: string) => { if (throwOn === "set") throw new DOMException("quota", "QuotaExceededError"); data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
  };
}

function cleared(list: Scenario[]): Progress {
  return Object.fromEntries(list.map(s => [s.id, { cleared: true, bestScore: 900, clearedAt: 1 }]));
}
const of = (category: Category) => scenarios.filter(s => s.category === category);
const noop = () => {};

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
  vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { hash: "" }, setTimeout, clearTimeout });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("파티 여부는 학습 기록에서 계산한다", () => {
  it("아무것도 안 풀었으면 파티가 없다", () => {
    expect(partyState(scenarios, {})).toEqual({ rooms: [], allClear: false });
  });

  it("한 분류를 모두 풀어야 그 운영실만 파티가 열린다", () => {
    const linux = of("linux");
    expect(partyState(scenarios, cleared(linux.slice(1))).rooms).toEqual([]);
    expect(partyState(scenarios, cleared(linux))).toEqual({ rooms: ["linux"], allClear: false });
  });

  it("모든 분류를 풀면 관제실 시상식(allClear)", () => {
    const state = partyState(scenarios, cleared(scenarios));
    expect(state.rooms).toHaveLength(OPEN_CATEGORIES.length);
    expect(state.allClear).toBe(true);
  });

  it("그 분류에 새 실습이 생기면 다시 근무 모드로 돌아간다", () => {
    const linux = of("linux");
    const extra = { ...linux[0], id: "linux-new-mission" } as Scenario;
    expect(partyState([...scenarios, extra], cleared(linux)).rooms).not.toContain("linux");
  });
});

describe("시작 연출은 한 번만", () => {
  it("본 기록 키에는 실습 개수가 들어가, 실습이 늘어 다시 다 풀면 새 파티로 본다", () => {
    const keys = celebrationKeys(scenarios, partyState(scenarios, cleared(scenarios)));
    expect(keys).toContain(`linux:${of("linux").length}`);
    expect(keys).toContain(`all:${scenarios.length}`);
  });

  it("봤다고 기록하면 다음에는 연출 대상이 아니다", () => {
    const progress = cleared(of("docker"));
    expect(pendingParties(scenarios, progress).rooms).toEqual(["docker"]);
    markSeen(celebrationKeys(scenarios, partyState(scenarios, progress)));
    expect(pendingParties(scenarios, progress).rooms).toEqual([]);
    clearSeen();
    expect(pendingParties(scenarios, progress).rooms).toEqual(["docker"]);
  });

  it("손상된 기록·막힌 저장소에서도 예외 없이 빈 기록으로 본다", () => {
    localStorage.setItem("incident-game/celebrations", "{not json");
    expect(loadSeen().size).toBe(0);
    localStorage.setItem("incident-game/celebrations", JSON.stringify(["linux:5", 42, null]));
    expect([...loadSeen()]).toEqual(["linux:5"]);
    vi.stubGlobal("localStorage", fakeStorage("get"));
    expect(loadSeen().size).toBe(0);
    vi.stubGlobal("localStorage", fakeStorage("set"));
    expect(() => markSeen(["linux:5"])).not.toThrow();
  });

  it("진행 기록을 초기화하면 본 기록도 지워진다", () => {
    markSeen(["linux:5"]);
    clearProgress();
    expect(loadSeen().size).toBe(0);
  });
});

describe("리포트의 파티 안내", () => {
  it("방금 끝낸 분류의 파티를 아직 못 봤으면 보러 가자고 한다", () => {
    const notice = partyNotice(scenarios, cleared(of("network")), "network");
    expect(notice?.message).toContain("핑퐁 대회");
    expect(notice?.action).toBe("파티 보러 가기");
  });

  it("다른 분류이거나 이미 본 파티면 띄우지 않는다", () => {
    const progress = cleared(of("network"));
    expect(partyNotice(scenarios, progress, "linux")).toBeNull();
    expect(partyNotice(scenarios, progress, "network", new Set([`network:${of("network").length}`]))).toBeNull();
  });

  it("마지막 분류까지 끝내면 시상식 안내", () => {
    expect(partyNotice(scenarios, cleared(scenarios), "aws")?.action).toBe("시상식 보러 가기");
  });

  it("리포트 화면에 안내와 버튼이 그려진다", () => {
    const html = renderToStaticMarkup(<ReportScreen session={createSession(scenarios[0], 0)} onBackToList={noop} onRetry={noop} onShare={noop}
      party={{ message: "이 운영실의 장애를 모두 해결했어요!", action: "파티 보러 가기" }} />);
    expect(html).toContain("party-callout");
    expect(html).toContain("파티 보러 가기");
  });
});

describe("오픈 예정 실습", () => {
  it("열린 분류에만, 빈칸 없이, 제목이 겹치지 않게 적는다", () => {
    const open = new Set(OPEN_CATEGORIES.map(c => c.id));
    const titles = new Set(scenarios.map(s => s.title));
    for (const item of upcomingScenarios) {
      expect(open.has(item.category)).toBe(true);
      expect(item.title.trim()).not.toBe("");
      expect(item.teaser.trim()).not.toBe("");
      expect(titles.has(item.title)).toBe(false);
    }
    expect(new Set(upcomingScenarios.map(u => u.title)).size).toBe(upcomingScenarios.length);
    expect(upcomingIn("kubernetes").every(u => u.category === "kubernetes")).toBe(true);
  });

  it("실습 목록에 잠긴 OPENING SOON 카드로 보인다(기록 화면에는 없다)", () => {
    const props = { scenarios, progress: {}, onSelect: noop, onResetProgress: noop, onExplore: noop, onOpenRecords: noop, onCommunity: noop };
    expect(renderToStaticMarkup(<ScenarioList {...props} />).match(/upcoming-badge/g)).toHaveLength(upcomingScenarios.length);
    expect(renderToStaticMarkup(<ScenarioList {...props} recordsOnly />)).not.toContain("upcoming-badge");
  });
});

describe("방마다 파티 그림", () => {
  const control = { stats: [], total: { label: "TOTAL", cleared: 24, total: 24 }, clock: "SHIFT 09:00", rooms: [] };
  // 방마다 그 방에만 있는 파티 표시. 근무 모드에서는 보이지 않아야 한다.
  const MARKS: Record<string, string> = {
    linux: "HAPPY UPTIME", network: "PING 1ms", "web-db": "ACID BAR", aws: "us-1",
    docker: "docker run --rm snacks", kubernetes: "iso-cannon-shot", control: "ALL SECTORS CLEAR", community: "iso-flame",
  };
  const svg = (node: ReactNode) => renderToStaticMarkup(<svg>{node}</svg>);

  for (const room of ROOMS.filter(r => r.kind in MARKS)) {
    it(`${room.name}: 파티 때만 장식이 나온다`, () => {
      expect(svg(<RoomArt kind={room.kind} control={control} party />)).toContain(MARKS[room.kind]);
      expect(svg(<RoomArt kind={room.kind} control={control} />)).not.toContain(MARKS[room.kind]);
    });
  }

  it("시작 연출(축포)은 kickoff일 때만 붙는다", () => {
    expect(svg(<RoomArt kind="linux" party kickoff />)).toContain("party-burst");
    expect(svg(<RoomArt kind="linux" party />)).not.toContain("party-burst");
  });

  it("파티 중인 방의 사람은 고깔모자를 쓰고, 서 있으면 춤추고 앉아 있으면 두 팔을 든다", () => {
    const person = (pose: "stand" | "type") => svg(<PartyContext.Provider value><Person at={[0, 0, 0]} pose={pose} shirt="#fff" prop="tablet" /></PartyContext.Provider>);
    expect(person("stand")).toContain("iso-dance");
    expect(person("type")).toContain("iso-wave");
    expect(person("type")).not.toContain("iso-typing");
    expect(svg(<Person at={[0, 0, 0]} shirt="#fff" />)).not.toContain("iso-dance");
  });

  it("캠퍼스는 처음 여는 파티에만 시작 연출과 안내 띠를 붙인다", () => {
    const props = { scenarios, progress: cleared(of("linux")), onSelect: noop, onResetProgress: noop, onExplore: noop, onOpenRecords: noop, onCommunity: noop };
    const first = renderToStaticMarkup(<ScenarioList {...props} />);
    expect(first).toContain("is-kickoff");
    expect(first).toContain("업타임 생일 파티 시작");
    markSeen([`linux:${of("linux").length}`]);
    const again = renderToStaticMarkup(<ScenarioList {...props} />);
    expect(again).not.toContain("is-kickoff");
    expect(again).toContain("is-party");
  });
});
