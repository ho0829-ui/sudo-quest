import { describe, expect, it } from "vitest";
import { box, plane, project, UNIT } from "../src/ui/campus/iso";
import { ROOMS, roomStatus } from "../src/ui/campus/rooms";
import { scenarios } from "../src/scenarios";

describe("아이소메트릭 투영", () => {
  it("x는 오른쪽 아래, y는 왼쪽 아래, z는 위로 간다", () => {
    const [x1, y1] = project([1, 0, 0]);
    const [x2, y2] = project([0, 1, 0]);
    const [, y3] = project([0, 0, 1]);
    expect(x1).toBeGreaterThan(0); expect(y1).toBeGreaterThan(0);
    expect(x2).toBeLessThan(0); expect(y2).toBeGreaterThan(0);
    expect(y3).toBe(-UNIT);
  });

  it("바닥과 상자는 꼭짓점 4개짜리 면을 만든다", () => {
    expect(plane(0, 0, 2, 2).split(" ")).toHaveLength(4);
    const faces = box(0, 0, 0, 1, 1, 2);
    for (const face of Object.values(faces)) expect(face.split(" ")).toHaveLength(4);
  });
});

describe("캠퍼스 방", () => {
  it("실습 분류 4개와 관제실·자료실이 한 번씩 있다", () => {
    expect(ROOMS.map(r => r.kind).sort()).toEqual(["aws", "control", "library", "linux", "network", "web-db"]);
  });

  it("분류별 방은 그 분류의 실습 수를 세고, 다 풀기 전까지 경보등을 켠다", () => {
    const linux = scenarios.filter(s => s.category === "linux");
    expect(roomStatus("linux", scenarios, {})).toEqual({ total: linux.length, cleared: 0, alarm: true });
    const all = Object.fromEntries(linux.map(s => [s.id, { cleared: true, bestScore: 900, clearedAt: 1 }]));
    expect(roomStatus("linux", scenarios, all).alarm).toBe(false);
  });

  it("관제실·자료실은 경보등이 없다", () => {
    expect(roomStatus("control", scenarios, {}).alarm).toBeNull();
    expect(roomStatus("library", scenarios, {}).alarm).toBeNull();
  });

});

describe("캠퍼스 꾸밈 규칙", () => {
  it("방마다 네온 색이 달라 서로 겹치지 않는다", async () => {
    const { THEMES } = await import("../src/ui/campus/themes");
    const accents = Object.values(THEMES).map(t => t.accent.toLowerCase());
    expect(new Set(accents).size).toBe(accents.length);
  });

  it("출동 대기 티켓은 아직 풀지 않은 실습만 보여 준다", async () => {
    const { pendingTickets } = await import("../src/ui/campus/IncidentTicker");
    const solved = { [scenarios[0].id]: { cleared: true, bestScore: 800, clearedAt: 1 } };
    const pending = pendingTickets(scenarios, solved);
    expect(pending).toHaveLength(scenarios.length - 1);
    expect(pending.map(s => s.id)).not.toContain(scenarios[0].id);
  });

  it("복도는 뒤쪽 층과 다음 층 사이에만 놓인다", async () => {
    const { CORRIDORS } = await import("../src/ui/campus/CampusGround");
    expect(CORRIDORS).toHaveLength(6);
    for (const c of CORRIDORS) expect([0, 1, 2]).toContain(c.rank);
  });
});
