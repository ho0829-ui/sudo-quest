/**
 * 큰 사내 카페의 평면도. 가구 자리와 손님(글쓴이)이 다닐 수 있는 길목 지점(그래프)을 정의한다. 순수 데이터라 테스트로 검사한다.
 *
 * 공간 좌표는 캠퍼스와 같다(x: 화면 오른쪽 아래, y: 왼쪽 아래). 오른쪽 벽(y=0)에 입구·긴 커피 바·TIL 무대,
 * 왼쪽 벽(x=0)에 창가 소파·코르크 게시판·창가 바 좌석이 있다. 가운데에 공용 장테이블, 둘레에 원탁, 오른쪽 앞에 회의 부스.
 * 길목은 세로 통로 5줄 × 가로 통로 4줄의 격자다. 손님은 이웃한 지점으로만 걸어서 가구를 뚫지 않는다.
 * 오른쪽 끝(무대·스탠딩 테이블)과 회의 부스·창가 바는 배경 직원 자리라 길목에 넣지 않는다(staff.ts).
 */
import type { Facing } from "../../campus/art/people";

export const FLOOR = { w: 22, d: 14, wall: 4.2 } as const;

export interface Spot {
  id: string;
  x: number;
  y: number;
  /** lane: 서 있는 길목, seat: 의자(앉는다), door: 입구, counter: 주문하는 자리 */
  kind: "lane" | "seat" | "door" | "counter";
  /** seat일 때 바라보는 쪽(테이블 쪽) */
  facing?: Facing;
}

/** 원탁 가운데. 의자는 좌우(x ± SEAT_GAP)에 하나씩. */
export const TABLES: [number, number][] = [
  [4.4, 3.85], [8.0, 3.85], [12.1, 3.85], [16.2, 3.85], [4.4, 7.1], [16.2, 7.1], [4.4, 10.8], [8.0, 10.8], [12.1, 10.8],
];
export const TABLE_RADIUS = 0.55;
export const SEAT_GAP = 0.85;

/** 공용 장테이블과 그 의자(북쪽 줄·남쪽 줄). 배경 직원이 앉은 의자는 손님 자리에서 뺀다. */
export const LONG_TABLE = { x: 6.7, y: 6.6, w: 6.8, d: 1.0 } as const;
export const LONG_SEATS_X = [7.3, 8.5, 9.7, 10.9, 12.1, 13.0];
export const LONG_SEAT_Y = { north: 6.15, south: 8.05 } as const;
/** 배경 직원이 차지한 장테이블 의자: [x, 줄] */
export const STAFF_LONG_SEATS: [number, "north" | "south"][] = [[8.5, "south"], [12.1, "north"]];

/** 스탠딩 테이블(배경 직원 구역). */
export const STANDING: [number, number][] = [[20.0, 7.0], [20.0, 10.8]];
export const STANDING_RADIUS = 0.35;

/** 가구가 차지하는 바닥 사각형 [x, y, w, d]. 길목 선이 지나가면 안 된다. */
export const BLOCKS: Record<string, [number, number, number, number]> = {
  counter: [9.0, 0.6, 8.2, 0.85],
  shelf: [0.5, 0.1, 3.0, 0.5],
  sofa: [0.15, 1.0, 0.95, 2.8],
  lowTable: [1.6, 1.6, 0.8, 1.2],
  longTable: [LONG_TABLE.x, LONG_TABLE.y, LONG_TABLE.w, LONG_TABLE.d],
  booth: [14.7, 9.5, 3.0, 2.6],
  stage: [18.8, 0.3, 3.0, 2.5],
  fridge: [17.6, 0.1, 0.9, 0.65],
  windowBar: [0.15, 9.3, 0.6, 3.9],
};

const LANE_X = [2.8, 6.0, 10.0, 14.2, 18.2];
const LANE_Y = [2.5, 5.2, 9.0, 12.6];
/** 장테이블이 가로막는 세로 통로 구간(x=10, y 5.2~9.0). */
const CUT: [string, string][] = [[laneId(2, 1), laneId(2, 2)]];

function laneId(i: number, j: number) { return `lane-${i}-${j}`; }

function buildSpots(): Spot[] {
  const spots: Spot[] = [];
  LANE_X.forEach((x, i) => LANE_Y.forEach((y, j) => spots.push({ id: laneId(i, j), x, y, kind: "lane" })));
  TABLES.forEach(([x, y], t) => {
    spots.push({ id: `seat-${t}-l`, x: x - SEAT_GAP, y, kind: "seat", facing: "right" });
    spots.push({ id: `seat-${t}-r`, x: x + SEAT_GAP, y, kind: "seat", facing: "left" });
  });
  const staffSeat = (x: number, row: "north" | "south") => STAFF_LONG_SEATS.some(([sx, r]) => sx === x && r === row);
  for (const row of ["north", "south"] as const) for (const x of LONG_SEATS_X) {
    if (staffSeat(x, row)) continue;
    // 북쪽 줄은 테이블(아래쪽)을 보고 앉아 얼굴이, 남쪽 줄은 등이 보인다.
    spots.push({ id: `long-${row}-${x}`, x, y: LONG_SEAT_Y[row], kind: "seat", facing: row === "north" ? "left" : "away-right" });
  }
  spots.push({ id: "door", x: 5.5, y: 0.35, kind: "door" });
  spots.push({ id: "counter", x: 12.6, y: 1.95, kind: "counter" });
  return spots;
}

export const SPOTS: Spot[] = buildSpots();
const BY_ID = new Map(SPOTS.map(s => [s.id, s]));
export function spot(id: string): Spot { return BY_ID.get(id)!; }

function nearestLane(s: Spot): Spot {
  const lanes = SPOTS.filter(l => l.kind === "lane");
  return lanes.reduce((best, l) => Math.hypot(l.x - s.x, l.y - s.y) < Math.hypot(best.x - s.x, best.y - s.y) ? l : best);
}

function buildEdges(): Map<string, string[]> {
  const edges = new Map<string, string[]>(SPOTS.map(s => [s.id, []]));
  const link = (a: string, b: string) => { edges.get(a)!.push(b); edges.get(b)!.push(a); };
  const cut = (a: string, b: string) => CUT.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  LANE_X.forEach((_, i) => LANE_Y.forEach((_, j) => {
    if (i + 1 < LANE_X.length) link(laneId(i, j), laneId(i + 1, j));
    if (j + 1 < LANE_Y.length && !cut(laneId(i, j), laneId(i, j + 1))) link(laneId(i, j), laneId(i, j + 1));
  }));
  // 의자·입구·카운터는 가장 가까운 길목 하나에만 이어진다(막다른 자리).
  for (const s of SPOTS) if (s.kind !== "lane") link(s.id, nearestLane(s).id);
  // 입구는 두 길목으로 나간다. 하나뿐이면 새 손님이 그 길목이 비기를 기다리며 문 앞에 서 있게 된다.
  link("door", laneId(0, 0));
  return edges;
}

export const EDGES: Map<string, string[]> = buildEdges();
export function neighbors(id: string): string[] { return EDGES.get(id) ?? []; }

/** 선분 ab와 점 p 사이 최단 거리. 길목 선이 테이블에 너무 붙는지 검사할 때 쓴다. */
export function segmentDistance(a: [number, number], b: [number, number], p: [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len)) : 0;
  return Math.hypot(a[0] + t * dx - p[0], a[1] + t * dy - p[1]);
}

/** 처음 자리: 의자와 길목을 번갈아 고르고, 같은 자리에 두 사람이 서지 않게 한다. allowed가 있으면 그 안에서만. */
export function startSpots(count: number, allowed?: Set<string>): string[] {
  const ok = (s: Spot) => !allowed || allowed.has(s.id);
  const seats = SPOTS.filter(s => s.kind === "seat" && ok(s)).map(s => s.id);
  const lanes = SPOTS.filter(s => s.kind === "lane" && ok(s)).map(s => s.id);
  const order: string[] = [];
  // 개수와 서로소인 보폭으로 건너뛰며 골라(모든 자리를 한 번씩 돈다) 처음 배치가 한쪽에 몰리지 않게 한다.
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const step = (n: number) => [7, 5, 11, 13].find(k => gcd(k, n) === 1) ?? 1;
  for (let i = 0; i < Math.max(seats.length, lanes.length); i++) {
    if (i < seats.length) order.push(seats[(i * step(seats.length)) % seats.length]);
    if (i < lanes.length) order.push(lanes[(i * step(lanes.length)) % lanes.length]);
  }
  return order.slice(0, count);
}

/** 좁은 화면에서 보이는 구역(가운데). 그 안의 자리만 써서 손님이 화면 밖으로 나가지 않게 한다. */
export const NARROW_AREA = { x0: 2.0, x1: 14.8, y0: 1.5, y1: 9.6 } as const;
export const NARROW_SPOTS = new Set(SPOTS.filter(s => s.kind === "door"
  || (s.x >= NARROW_AREA.x0 && s.x <= NARROW_AREA.x1 && s.y >= NARROW_AREA.y0 && s.y <= NARROW_AREA.y1)).map(s => s.id));
