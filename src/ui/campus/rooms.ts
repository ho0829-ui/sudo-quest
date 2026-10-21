/**
 * 캠퍼스의 방 배치와 상태. 방의 경보등은 "아직 풀지 않은 실습이 있다"는 학습 진행 표시일 뿐,
 * 실제 서버 모니터링 값이 아니다.
 */
import type { Category, Scenario } from "../../engine/scenario/types";
import { CATEGORIES, CATEGORY_LIST, RESERVED_SLOTS } from "../categories";
import type { Progress } from "../storage";

export type RoomKind = Category | "control" | "library" | "community";
export type Slot = readonly [col: number, row: number];

export interface RoomInfo {
  kind: RoomKind;
  /** 캠퍼스 격자 칸 [열, 행]. 위치·문·복도·그리는 순서가 모두 여기서 나온다(layout.ts). */
  slot: Slot;
  /** 공간 좌표에서 방의 왼쪽 위 모서리. 방 크기는 ROOM_SIZE × ROOM_SIZE. */
  origin: [number, number];
  name: string;
  tag: string;
  blurb: string;
  /** 방은 지어 두었지만 아직 들어갈 수 없다(실습·게시판 준비 중). */
  soon?: boolean;
}

export const ROOM_SIZE = 10;
export const WALL_HEIGHT = 4.2;
// 방 사이에 폭 2짜리 복도를 둔다. 격자 한 칸 = 방 + 복도.
export const STRIDE = ROOM_SIZE + 2;

/** 뒤에서 앞으로 그리는 층. 열+행이 같은 방끼리는 화면에서 겹치지 않는다. */
export function roomRank({ slot: [col, row] }: Pick<RoomInfo, "slot">): number {
  return col + row;
}

const FIXED_ROOMS: Omit<RoomInfo, "origin">[] = [
  { kind: "library", slot: RESERVED_SLOTS.library, name: "자료실", tag: "KNOWLEDGE",
    blurb: "공식 문서 100개 주제를 근거와 함께 찾아보는 곳" },
  { kind: "control", slot: RESERVED_SLOTS.control, name: "관제실", tag: "CONTROL",
    blurb: "지금까지 해결한 장애와 최고 점수를 모아 보는 곳" },
  { kind: "community", slot: RESERVED_SLOTS.community, name: "커뮤니티실", tag: "COMMUNITY", soon: true,
    blurb: "스터디원과 장애 경험·질문을 나누는 게시판 카페" },
];

const LAB_ROOMS: Omit<RoomInfo, "origin">[] = CATEGORY_LIST.map(c => ({
  kind: c.id, slot: c.slot, name: c.room, tag: c.wallTag, blurb: c.blurb, soon: c.comingSoon,
}));

// 그리는 순서(뒤 → 앞, 같은 층은 왼쪽 열부터)로 정렬해 둔다. 미니맵·입장 애니메이션 순서도 이 순서를 따른다.
export const ROOMS: RoomInfo[] = [...FIXED_ROOMS, ...LAB_ROOMS]
  .map(room => ({ ...room, origin: [room.slot[0] * STRIDE, room.slot[1] * STRIDE] as [number, number] }))
  .sort((a, b) => roomRank(a) - roomRank(b) || a.slot[0] - b.slot[0]);

export interface RoomStatus {
  total: number;
  cleared: number;
  /** 풀지 않은 실습이 있으면 경보등을 켠다. 실습 방이 아니거나(관제실·자료실·커뮤니티실) 준비 중이면 null. */
  alarm: boolean | null;
}

function isLabRoom(kind: RoomKind): kind is Category {
  return kind !== "control" && kind !== "library" && kind !== "community";
}

export function roomStatus(kind: RoomKind, scenarios: Scenario[], progress: Progress): RoomStatus {
  const own = isLabRoom(kind) ? scenarios.filter(s => s.category === kind) : scenarios;
  const cleared = own.filter(s => progress[s.id]?.cleared).length;
  const hasAlarm = isLabRoom(kind) && !CATEGORIES[kind].comingSoon;
  return { total: own.length, cleared, alarm: hasAlarm ? cleared < own.length : null };
}

