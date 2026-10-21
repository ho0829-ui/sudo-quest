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
  it("실습 분류마다 운영실 하나와 관제실·자료실이 한 번씩 있다", async () => {
    const { CATEGORY_IDS } = await import("../src/engine");
    expect(ROOMS.map(r => r.kind).sort()).toEqual([...CATEGORY_IDS, "control", "library"].sort());
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
    const { CORRIDORS } = await import("../src/ui/campus/layout");
    expect(CORRIDORS).toHaveLength(6);
    for (const c of CORRIDORS) expect([0, 1, 2]).toContain(c.rank);
  });
});

describe("캠퍼스 배치 계산(칸 → 위치·문·복도)", () => {
  it("지금 방 6개 배치는 손으로 정해 두었던 값과 똑같이 나온다", async () => {
    const { CORRIDORS, campusViewBox, doorsOf, miniMapLayout } = await import("../src/ui/campus/layout");
    const { roomRank } = await import("../src/ui/campus/rooms");
    expect(ROOMS.map(r => [r.kind, r.origin])).toEqual([
      ["library", [0, 0]], ["linux", [0, 12]], ["network", [12, 0]],
      ["control", [12, 12]], ["web-db", [12, 24]], ["aws", [24, 12]],
    ]);
    expect(Object.fromEntries(ROOMS.map(r => [r.kind, doorsOf(r)]))).toEqual({
      library: [], linux: ["right"], network: ["left"], control: ["left", "right"], "web-db": ["right"], aws: ["left"],
    });
    expect(Object.fromEntries(ROOMS.map(r => [r.kind, roomRank(r)]))).toEqual({
      library: 0, linux: 1, network: 1, control: 2, "web-db": 3, aws: 3,
    });
    expect(CORRIDORS).toEqual([
      { x: 4, y: 10, axis: "y", rank: 0 },
      { x: 10, y: 4, axis: "x", rank: 0, walker: { shirt: "#ffcf8a", hair: "#2a1d18" } },
      { x: 10, y: 16, axis: "x", rank: 1, walker: { shirt: "#00ff66", hair: "#121212" } },
      { x: 16, y: 10, axis: "y", rank: 1, robot: true },
      { x: 16, y: 22, axis: "y", rank: 2, walker: { shirt: "#ff2d95", hair: "#6b4a2f" } },
      { x: 22, y: 16, axis: "x", rank: 2 },
    ]);
    expect(campusViewBox()).toBe("-440 -128 880 760");
    expect(miniMapLayout()).toEqual({
      cells: [[30, 10], [16, 18], [44, 18], [30, 26], [16, 34], [44, 34]], width: 62, height: 46,
    });
  });

  it("빈 칸에 운영실을 더해도 지도·미니맵이 그 칸까지 넓어진다", async () => {
    const { campusViewBox, miniMapLayout } = await import("../src/ui/campus/layout");
    const extra = { kind: "linux" as const, slot: [2, 2] as const, origin: [24, 24] as [number, number], name: "", tag: "", blurb: "" };
    const [, top, , height] = campusViewBox([...ROOMS, extra]).split(" ").map(Number);
    expect(top + height).toBeGreaterThan(632);
    const map = miniMapLayout([...ROOMS, extra]);
    expect(map.height).toBeGreaterThan(46);
    for (const [x, y] of map.cells) {
      expect(x - 9).toBeGreaterThanOrEqual(0); expect(x + 9).toBeLessThanOrEqual(map.width);
      expect(y + 5).toBeLessThanOrEqual(map.height);
    }
  });
});

describe("분류 레지스트리 빠짐 검사", () => {
  it("엔진의 모든 분류에 화면 정보·색이 있고, 분류마다 실습이 1개 이상 있다", async () => {
    const { CATEGORY_IDS } = await import("../src/engine");
    const { CATEGORIES } = await import("../src/ui/categories");
    const { THEMES } = await import("../src/ui/campus/themes");
    for (const id of CATEGORY_IDS) {
      expect(CATEGORIES[id], id).toBeDefined();
      expect(THEMES[id], id).toBeDefined();
      expect(scenarios.filter(s => s.category === id).length, id).toBeGreaterThan(0);
    }
  });

  it("운영실 칸은 3×3 격자 안에서 서로·예약 칸과 겹치지 않는다", async () => {
    const { CATEGORY_LIST, GRID_SIZE, RESERVED_SLOTS } = await import("../src/ui/categories");
    const used = [RESERVED_SLOTS.library, RESERVED_SLOTS.control, ...CATEGORY_LIST.map(c => c.slot)].map(s => s.join(","));
    expect(new Set(used).size).toBe(used.length);
    for (const { id, slot: [col, row] } of CATEGORY_LIST) {
      expect(col >= 0 && col < GRID_SIZE && row >= 0 && row < GRID_SIZE, id).toBe(true);
    }
  });

  it("자료실을 뺀 모든 방은 복도로 이어져 있다(문이 하나 이상)", async () => {
    const { doorsOf } = await import("../src/ui/campus/layout");
    for (const room of ROOMS.filter(r => r.kind !== "library")) expect(doorsOf(room).length, room.kind).toBeGreaterThan(0);
  });

  it("운영실 이름은 \"운영실\"로 끝나고 서로 다르다", async () => {
    const { CATEGORY_LIST } = await import("../src/ui/categories");
    const names = CATEGORY_LIST.map(c => c.room);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name.endsWith("운영실"), name).toBe(true);
  });
});
