/**
 * 올클리어 피날레·엔딩 크레딧: 크레딧 데이터(사람·기능·무덤·자동 실습 목록), 음악 악보, 불꽃 계산, 화면 렌더링.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { scenarios } from "../src/scenarios";
import { CAST, CHAPTERS, GRAVEYARD, MUSIC_CREDIT, rollCall, SPECIAL_GUESTS } from "../src/ui/ending/creditRoll";
import { FADE_IN, loadMusicOn, LOOP_SIXTEENTHS, MELODY, noteFrequency, saveMusicOn, songEvents } from "../src/ui/ending/music";
import { clampVolume, DEFAULT_VOLUME, loadVolume, saveVolume } from "../src/ui/ending/musicPrefs";
import { advance, burst, MAX_SPARKS, rocket, seededRandom, stillFrame } from "../src/ui/ending/sparks";
import { Credits } from "../src/ui/ending/Credits";
import { nextSpeed, SPEEDS } from "../src/ui/ending/useCreditRoll";
import { Finale } from "../src/ui/ending/Finale";
import { ScenarioList } from "../src/ui/screens/ScenarioList";

afterEach(() => { vi.unstubAllGlobals(); });
const noop = () => {};

describe("크레딧 데이터", () => {
  it("세 사람이 모두 출연한다", () => {
    expect(CAST.map(c => c.name)).toEqual(["Choi", "Claude", "GPT (Codex)"]);
    for (const c of CAST) expect(c.role && c.lines.length).toBeTruthy();
  });

  it("기능 장마다 만든 사람과 한 줄 이상의 설명이 있다", () => {
    expect(CHAPTERS.length).toBeGreaterThanOrEqual(6);
    for (const ch of CHAPTERS) {
      expect(ch.title.trim() && ch.credit.trim()).toBeTruthy();
      expect(ch.lines.length).toBeGreaterThan(0);
    }
    expect(SPECIAL_GUESTS.length).toBeGreaterThan(0);
    expect(MUSIC_CREDIT.lines.join(" ")).toContain("퍼블릭 도메인");
  });

  it("무덤: 이름은 겹치지 않고 비석에 들어갈 만큼 짧으며, 떠난 날은 실제 날짜이고 묘비명이 있다", () => {
    expect(new Set(GRAVEYARD.map(t => t.name)).size).toBe(GRAVEYARD.length);
    for (const tomb of GRAVEYARD) {
      expect(tomb.name.length).toBeLessThanOrEqual(26);
      expect(tomb.died).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(tomb.died))).toBe(false);
      // 프로젝트가 시작된 날(2026-09-11) 이후에만 무언가가 사라질 수 있다.
      expect(tomb.died >= "2026-09-11").toBe(true);
      expect(tomb.epitaph.trim()).not.toBe("");
    }
  });

  it("실습 목록은 시나리오 데이터에서 자동으로 만들어 모든 실습이 한 번씩 나온다", () => {
    const roll = rollCall(scenarios);
    expect(roll.total).toBe(scenarios.length);
    const titles = roll.groups.flatMap(g => g.titles);
    expect(titles.sort()).toEqual(scenarios.map(s => s.title).sort());
    expect(roll.commands).toBeGreaterThan(15);
  });
});

describe("엔딩 음악(캉캉 8비트)", () => {
  it("음 이름을 주파수로 바꾼다", () => {
    expect(noteFrequency("A4")).toBe(440);
    expect(noteFrequency("C4")).toBeCloseTo(261.63, 1);
    expect(noteFrequency("F#5")).toBeCloseTo(739.99, 1);
    expect(noteFrequency("R")).toBe(0);
    expect(() => noteFrequency("H2")).toThrow();
  });

  it("마디마다 16분음표 8칸(2/4박자)이 꽉 찬다", () => {
    for (const bar of MELODY) expect(bar.reduce((sum, [, length]) => sum + length, 0)).toBe(8);
  });

  it("한 바퀴의 음은 시간 순서이고 모두 바퀴 안에 있다", () => {
    const events = songEvents();
    expect(events.length).toBeGreaterThan(80);
    events.forEach((e, i) => {
      if (i) expect(e.at).toBeGreaterThanOrEqual(events[i - 1].at);
      expect(e.at).toBeLessThan(LOOP_SIXTEENTHS);
      if (e.voice !== "hat") expect(e.freq).toBeGreaterThan(50);
    });
    expect(new Set(events.map(e => e.voice))).toEqual(new Set(["lead", "bass", "hat"]));
  });

  it("음악 켜기 선택을 기억하고, 저장소가 막혀도 예외 없이 켬으로 본다", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    expect(loadMusicOn()).toBe(true);
    saveMusicOn(false);
    expect(loadMusicOn()).toBe(false);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(loadMusicOn()).toBe(true);
    expect(() => saveMusicOn(true)).not.toThrow();
  });
});

describe("음악 볼륨", () => {
  it("처음엔 작은 볼륨(25%)으로, 서서히 커지며 시작한다(갑자기 큰 소리 방지)", () => {
    expect(DEFAULT_VOLUME).toBe(0.25);
    expect(FADE_IN).toBeGreaterThanOrEqual(1.5);
  });

  it("볼륨은 0~1로 잘라 기억하고, 저장이 없거나 이상하거나 막히면 기본값", () => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) });
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
    saveVolume(0.8);
    expect(loadVolume()).toBe(0.8);
    saveVolume(7);
    expect(loadVolume()).toBe(1);
    data.set("incident-game/music-volume", "abc");
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
    expect(clampVolume(-1)).toBe(0);
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
    expect(loadVolume()).toBe(DEFAULT_VOLUME);
    expect(() => saveVolume(0.5)).not.toThrow();
  });
});

describe("불꽃놀이 계산", () => {
  it("로켓은 수명이 다하면 그 자리에서 불꽃으로 터진다", () => {
    const random = seededRandom(1);
    const r = rocket(800, 600, random);
    expect(r.vy).toBeLessThan(0);
    let sparks = [r];
    for (let t = 0; t < r.max + 0.1; t += 1 / 60) sparks = advance(sparks, 1 / 60, random);
    expect(sparks.length).toBeGreaterThan(50);
    expect(sparks.every(s => s.kind === "spark")).toBe(true);
  });

  it("불꽃은 사방으로 퍼졌다가 수명이 다하면 사라지고, 너무 많아지면 오래된 것부터 버린다", () => {
    const random = seededRandom(2);
    const sparks = burst(400, 300, "#fff", random, 40);
    expect(sparks.some(s => s.vx > 0) && sparks.some(s => s.vx < 0) && sparks.some(s => s.vy < 0)).toBe(true);
    expect(advance(sparks, 5, random)).toHaveLength(0);
    const many = Array.from({ length: 30 }, () => burst(0, 0, "#fff", random, 80)).flat();
    expect(advance(many, 1 / 60, random)).toHaveLength(MAX_SPARKS);
  });

  it("움직임을 끈 사람의 멈춘 장면은 매번 같다", () => {
    expect(stillFrame(800, 600)).toEqual(stillFrame(800, 600));
  });
});

describe("피날레·크레딧 화면", () => {
  it("피날레는 ALL CLEAR와 축하 메시지, 기록 요약, 크레딧 버튼을 보여 주는 대화 상자다", () => {
    const html = renderToStaticMarkup(<Finale cleared={24} total={24} xp={21412} motion={false} onCredits={noop} onClose={noop} />);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="ALL CLEAR"');
    expect(html).toContain("모든 장애를 해결했어요");
    expect(html).toContain("21,412");
    expect(html).toContain("전설의 온콜");
    expect(html).toContain("엔딩 크레딧 보기");
  });

  it("크레딧에 세 사람, 모든 실습 제목, 무덤 비석, 음악 출처가 나온다", () => {
    const html = renderToStaticMarkup(<Credits scenarios={scenarios} motion={false} onClose={noop} />);
    for (const c of CAST) expect(html).toContain(c.name);
    for (const s of scenarios) expect(html).toContain(s.title.replace(/'/g, "&#x27;").replace(/"/g, "&quot;"));
    expect(html.match(/class="tomb"/g)).toHaveLength(GRAVEYARD.length);
    expect(html).toContain("오펜바흐");
    expect(html).toContain("THE END");
  });

  it("학습 기록 화면은 모든 실습을 해결했을 때만 피날레·크레딧 다시 보기를 보여 준다", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { hash: "" } });
    const all = Object.fromEntries(scenarios.map(s => [s.id, { cleared: true, bestScore: 900, clearedAt: 1 }]));
    const props = { scenarios, onSelect: noop, onResetProgress: noop, onExplore: noop, onOpenRecords: noop, onCommunity: noop, onFinale: noop, onCredits: noop, recordsOnly: true };
    expect(renderToStaticMarkup(<ScenarioList {...props} progress={all} />)).toContain("allclear-banner");
    const { [scenarios[0].id]: _, ...almost } = all;
    expect(renderToStaticMarkup(<ScenarioList {...props} progress={almost} />)).not.toContain("allclear-banner");
  });

  it("크레딧에는 빨리 감기·위치 막대가 있고, 빨리 감기는 1→2→4→8→1배로 돈다", () => {
    const html = renderToStaticMarkup(<Credits scenarios={scenarios} motion onClose={noop} />);
    expect(html).toContain("빨리 감기");
    expect(html).toContain('aria-label="크레딧 위치"');
    expect(SPEEDS.map(nextSpeed)).toEqual([2, 4, 8, 1]);
  });

  it("실습 카드: 해결한 카드는 해결 완료 배지와 큰 최고 점수, 모든 카드는 분류 색(--cat)", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), location: { hash: "" } });
    const progress = { [scenarios[0].id]: { cleared: true, bestScore: 876, clearedAt: 1 } };
    const html = renderToStaticMarkup(<ScenarioList scenarios={scenarios} progress={progress} onSelect={noop} onResetProgress={noop} onExplore={noop} onOpenRecords={noop} onCommunity={noop} />);
    expect(html.match(/card-cleared-badge/g)).toHaveLength(1);
    expect(html).toContain('aria-label="최고 점수 876점"');
    expect(html).toContain("is-cleared");
    expect(html.match(/--cat:#/g)!.length).toBeGreaterThanOrEqual(scenarios.length);
  });
});
