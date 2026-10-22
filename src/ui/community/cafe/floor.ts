/**
 * 큰 카페의 평면도. 가구 자리와 손님이 다닐 수 있는 길목 지점(그래프)을 정의한다. 순수 데이터라 테스트로 검사한다.
 *
 * 공간 좌표는 캠퍼스와 같다(x: 화면 오른쪽 아래, y: 왼쪽 아래). 오른쪽 벽(y=0)에 카운터와 문,
 * 왼쪽 벽(x=0)에 창문·소파·코르크 게시판이 있고, 테이블 여섯 개가 두 줄로 놓인다.
 * 길목은 테이블 사이 세로 통로 네 줄 × 가로 통로 세 줄의 격자다. 손님은 이웃한 지점으로만 걸어서 가구를 뚫지 않는다.
 */
export const FLOOR = { w: 14, d: 10, wall: 4.2 } as const;

export interface Spot {
  id: string;
  x: number;
  y: number;
  /** lane: 서 있는 길목, seat: 테이블 의자(앉는다), door: 입구, counter: 주문하는 자리 */
  kind: "lane" | "seat" | "door" | "counter";
  /** seat일 때 바라보는 테이블 쪽 */
  facing?: "left" | "right";
}

/** 테이블 가운데. 의자는 좌우(x ± SEAT_GAP)에 하나씩. */
export const TABLES: [number, number][] = [[4.5, 4.0], [8.2, 4.0], [11.6, 4.0], [4.5, 7.7], [8.2, 7.7], [11.6, 7.7]];
export const TABLE_RADIUS = 0.55;
export const SEAT_GAP = 0.85;

/** 가구가 차지하는 바닥 사각형 [x, y, w, d]. 길목 선이 지나가면 안 된다. */
export const BLOCKS: [number, number, number, number][] = [
  [8.5, 0.6, 4.2, 0.85],  // 바 카운터
  [0.5, 0.1, 3.0, 0.5],   // 보드게임 선반
  [0.15, 1.0, 0.95, 2.8], // 소파
  [1.6, 1.6, 0.8, 1.2],   // 소파 앞 낮은 탁자
];

const LANE_X = [2.8, 6.4, 10.0, 13.2];
const LANE_Y = [2.4, 5.85, 9.3];

function laneId(i: number, j: number) { return `lane-${i}-${j}`; }

function buildSpots(): Spot[] {
  const spots: Spot[] = [];
  LANE_X.forEach((x, i) => LANE_Y.forEach((y, j) => spots.push({ id: laneId(i, j), x, y, kind: "lane" })));
  TABLES.forEach(([x, y], t) => {
    spots.push({ id: `seat-${t}-l`, x: x - SEAT_GAP, y, kind: "seat", facing: "right" });
    spots.push({ id: `seat-${t}-r`, x: x + SEAT_GAP, y, kind: "seat", facing: "left" });
  });
  spots.push({ id: "door", x: 5.5, y: 0.35, kind: "door" });
  spots.push({ id: "counter", x: 11.2, y: 1.95, kind: "counter" });
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
  LANE_X.forEach((_, i) => LANE_Y.forEach((_, j) => {
    if (i + 1 < LANE_X.length) link(laneId(i, j), laneId(i + 1, j));
    if (j + 1 < LANE_Y.length) link(laneId(i, j), laneId(i, j + 1));
  }));
  // 의자·입구·카운터는 가장 가까운 길목 하나에만 이어진다(막다른 자리).
  for (const s of SPOTS) if (s.kind !== "lane") link(s.id, nearestLane(s).id);
  // 입구는 두 길목으로 나간다. 하나뿐이면 새 손님이 그 길목에 사람이 비기를 기다리며 문 앞에 서 있게 된다.
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

/** 처음 자리: 의자와 길목을 번갈아 고르고, 같은 자리에 두 사람이 서지 않게 한다. */
export function startSpots(count: number): string[] {
  const seats = SPOTS.filter(s => s.kind === "seat").map(s => s.id);
  const lanes = SPOTS.filter(s => s.kind === "lane").map(s => s.id);
  const order: string[] = [];
  for (let i = 0; order.length < seats.length + lanes.length; i++) {
    if (i < seats.length) order.push(seats[(i * 5) % seats.length]);
    if (i < lanes.length) order.push(lanes[(i * 7) % lanes.length]);
  }
  return order.slice(0, count);
}
