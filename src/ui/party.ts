/**
 * 운영실 파티. 한 분류의 열린 실습을 모두 해결하면 그 방이 파티 모드가 된다.
 * 파티 여부는 학습 기록에서 계산하고(저장하지 않음), "시작 연출을 봤다"는 사실만 따로 저장한다.
 * 나중에 그 분류에 실습이 늘면 다시 근무 모드로 돌아가고, 다 풀면 새 개수 기준으로 파티가 다시 열린다.
 */
import type { Category, Scenario } from "../engine/scenario/types";
import { CATEGORIES, OPEN_CATEGORIES } from "./categories";
import type { Progress } from "./storage";

const SEEN_KEY = "incident-game/celebrations";

/** 운영실마다 파티 이름. 방의 성격을 살린 파티라 이름도 다르다. */
export const PARTY_NAMES: Record<Category, string> = {
  linux: "업타임 생일 파티", network: "핑퐁 대회", "web-db": "쿼리 칵테일 바",
  aws: "루프톱 풍선 파티", docker: "고래 풀 파티", kubernetes: "선상 보물 연회",
};
export const FINALE_NAME = "전사 시상식";

export interface PartyState {
  /** 파티 중인 운영실 */
  rooms: Category[];
  /** 모든 운영실이 파티 중이면 관제실 시상식 */
  allClear: boolean;
}

export function partyState(scenarios: Scenario[], progress: Progress): PartyState {
  const rooms = OPEN_CATEGORIES.map(c => c.id).filter(id => {
    const own = scenarios.filter(s => s.category === id);
    return own.length > 0 && own.every(s => progress[s.id]?.cleared);
  });
  return { rooms, allClear: rooms.length > 0 && rooms.length === OPEN_CATEGORIES.length };
}

/** 연출 기록의 키. 실습 개수를 넣어, 실습이 늘어 다시 다 풀면 새 파티로 본다. */
export function celebrationKeys(scenarios: Scenario[], state: PartyState): string[] {
  const keys = state.rooms.map(id => `${id}:${scenarios.filter(s => s.category === id).length}`);
  return state.allClear ? [...keys, `all:${scenarios.length}`] : keys;
}

export function loadSeen(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

export function markSeen(keys: string[]) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify([...new Set([...loadSeen(), ...keys])]));
  } catch { /* 저장이 막혀도 연출만 다시 볼 뿐이다 */ }
}

export function clearSeen() {
  try { localStorage.removeItem(SEEN_KEY); } catch { /* 무시 */ }
}

/** 아직 시작 연출을 보지 않은 파티. 캠퍼스가 이 방들에 한 번 연출을 재생한다. */
export function pendingParties(scenarios: Scenario[], progress: Progress, seen = loadSeen()) {
  const state = partyState(scenarios, progress);
  const rooms = state.rooms.filter(id => !seen.has(`${id}:${scenarios.filter(s => s.category === id).length}`));
  return { rooms, allClear: state.allClear && !seen.has(`all:${scenarios.length}`) };
}

export interface PartyNotice {
  message: string;
  action: string;
}

/**
 * 리포트 화면 안내. 방금 푼 실습으로 그 운영실(또는 전체)이 끝났고 아직 파티를 못 봤으면 보러 가자고 알린다.
 * 이미 본 파티나 다시 푼 실습에는 띄우지 않는다.
 */
export function partyNotice(scenarios: Scenario[], progress: Progress, category: Category, seen = loadSeen()): PartyNotice | null {
  const pending = pendingParties(scenarios, progress, seen);
  if (pending.allClear) return { message: `모든 운영실의 장애를 해결했어요! 관제실에서 ${FINALE_NAME}이 열렸어요.`, action: "시상식 보러 가기" };
  if (pending.rooms.includes(category)) {
    return { message: `이 운영실의 장애를 모두 해결했어요! ${CATEGORIES[category].room}에서 ${PARTY_NAMES[category]}가 열렸어요.`, action: "파티 보러 가기" };
  }
  return null;
}
