/**
 * 캠퍼스 배치 계산. 문·복도·그리는 층·지도 크기·미니맵 칸을 방의 격자 칸(slot)에서 계산한다.
 * 새 운영실은 src/ui/categories.ts에 칸 하나만 정하면 나머지가 여기서 따라 나온다.
 */
import { project } from "./iso";
import { GRID_SIZE } from "../categories";
import { ROOM_SIZE, ROOMS, STRIDE, WALL_HEIGHT, roomRank, type RoomInfo, type RoomKind } from "./rooms";

export type Wall = "left" | "right";

/** 복도. axis는 사람이 지나가는 방향, rank는 이 복도가 이어 주는 앞쪽 방의 직전 층이다. */
export interface CorridorSpec { x: number; y: number; axis: "x" | "y"; rank: number; walker?: { shirt: string; hair: string }; robot?: boolean }

// 복도는 벽 가운데(4~6)로 이어진다.
const DOOR_OFFSET = ROOM_SIZE / 2 - 1;

function roomAt(col: number, row: number): RoomInfo | undefined {
  return ROOMS.find(room => room.slot[0] === col && room.slot[1] === row);
}

/**
 * 방이 뒤쪽 이웃과 이어지는 벽. 왼쪽 열의 방과는 왼쪽 벽, 위쪽 행의 방과는 오른쪽 벽으로 이어진다.
 * 앞쪽 벽은 그리지 않으므로(방 안이 보이게) 문은 항상 앞쪽 방의 뒷벽에 낸다.
 */
export function doorsOf(room: RoomInfo): Wall[] {
  const [col, row] = room.slot;
  const doors: Wall[] = [];
  if (roomAt(col - 1, row)) doors.push("left");
  if (roomAt(col, row - 1)) doors.push("right");
  return doors;
}

// 복도를 지나는 사람·로봇. 장식이라 어떤 복도에 둘지는 손으로 고른다. 새 복도는 빈 채로 시작한다.
const PASSERS: Partial<Record<`${RoomKind}>${RoomKind}`, Pick<CorridorSpec, "walker" | "robot">>> = {
  "library>network": { walker: { shirt: "#ffcf8a", hair: "#2a1d18" } },
  "linux>control": { walker: { shirt: "#00ff66", hair: "#121212" } },
  "network>control": { robot: true },
  "control>web-db": { walker: { shirt: "#ff2d95", hair: "#6b4a2f" } },
};

function corridorsOf(room: RoomInfo): CorridorSpec[] {
  const [col, row] = room.slot;
  const rank = roomRank(room) - 1;
  const result: CorridorSpec[] = [];
  const left = roomAt(col - 1, row);
  if (left) {
    result.push({ x: col * STRIDE - 2, y: row * STRIDE + DOOR_OFFSET, axis: "x", rank, ...PASSERS[`${left.kind}>${room.kind}`] });
  }
  const up = roomAt(col, row - 1);
  if (up) {
    result.push({ x: col * STRIDE + DOOR_OFFSET, y: row * STRIDE - 2, axis: "y", rank, ...PASSERS[`${up.kind}>${room.kind}`] });
  }
  return result;
}

export const CORRIDORS: CorridorSpec[] = ROOMS.flatMap(corridorsOf);

/** 가장 앞쪽 층 번호. 이 층까지 차례로 그린다. */
export const MAX_RANK = Math.max(...ROOMS.map(roomRank));

/** 바닥 격자가 덮는 범위(공간 좌표). 3×3 격자 전체보다 조금 넓다. */
export const GROUND_EXTENT = { from: -6, to: GRID_SIZE * STRIDE - 2 + 6 };

const outward = (value: number, step = 8) => (value < 0 ? Math.floor(value / step) : Math.ceil(value / step)) * step;

/**
 * 방이 놓인 칸만큼 SVG viewBox를 잡는다. 위쪽은 경보등 기둥 끝까지 넣고, 나머지는 여백 16을 준다.
 * (빈 칸까지 넣으면 방 6개일 때 지도가 작아지므로 실제로 쓴 칸만 잰다.)
 */
export function campusViewBox(rooms: RoomInfo[] = ROOMS): string {
  const corners = rooms.flatMap(({ origin: [x, y] }) => [
    project([x, y + ROOM_SIZE, 0]), project([x + ROOM_SIZE, y, 0]),
    project([x + ROOM_SIZE, y + ROOM_SIZE, 0]), project([x, y, WALL_HEIGHT + 1.15]),
  ]);
  const left = outward(Math.min(...corners.map(([px]) => px)) - 16);
  const right = outward(Math.max(...corners.map(([px]) => px)) + 16);
  const top = outward(Math.min(...corners.map(([, py]) => py)) - 8);
  const bottom = outward(Math.max(...corners.map(([, py]) => py)) + 16);
  return `${left} ${top} ${right - left} ${bottom - top}`;
}

/** 관제실 미니맵: 방마다 마름모 중심 좌표와 화면 크기. 칸이 늘면 화면을 키우고, 그리는 쪽에서 줄여 맞춘다. */
export function miniMapLayout(rooms: RoomInfo[] = ROOMS): { cells: [number, number][]; width: number; height: number } {
  const raw = rooms.map(({ slot: [col, row] }) => [(col - row) * 14, (col + row) * 8] as const);
  const shift = 16 - Math.min(...raw.map(([x]) => x));
  const cells = raw.map(([x, y]) => [x + shift, y + 10] as [number, number]);
  return {
    cells,
    width: Math.max(...cells.map(([x]) => x)) + 18,
    height: Math.max(...cells.map(([, y]) => y)) + 12,
  };
}
