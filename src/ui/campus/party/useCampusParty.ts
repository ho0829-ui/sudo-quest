import { useEffect, useState } from "react";
import type { Category, Scenario } from "../../../engine/scenario/types";
import { CATEGORIES } from "../../categories";
import { celebrationKeys, FINALE_NAME, markSeen, PARTY_NAMES, partyState, pendingParties } from "../../party";
import type { Progress } from "../../storage";
import type { RoomKind } from "../rooms";

const TOAST_MS = 6500;

function toastText({ rooms, allClear }: { rooms: Category[]; allClear: boolean }): string | null {
  if (allClear) return `모든 운영실의 장애를 해결했어요! 관제실에서 ${FINALE_NAME}이 열렸어요`;
  if (!rooms.length) return null;
  const names = rooms.map(id => `${CATEGORIES[id].room} ${PARTY_NAMES[id]}`).join(", ");
  return `${names} 시작! 장애를 모두 해결했어요`;
}

/**
 * 캠퍼스의 파티 상태. 파티 여부는 학습 기록에서 매번 계산하고, 시작 연출은 처음 볼 때 한 번만 재생한다.
 * 처음 그릴 때 "아직 못 본 파티"를 붙잡아 두고 곧바로 봤다고 기록한다(다시 와도 연출이 반복되지 않게).
 */
export function useCampusParty(scenarios: Scenario[], progress: Progress) {
  const state = partyState(scenarios, progress);
  const [kickoff] = useState(() => pendingParties(scenarios, progress));
  const [toast, setToast] = useState(() => toastText(kickoff));

  useEffect(() => {
    markSeen(celebrationKeys(scenarios, partyState(scenarios, progress)));
    // 동작 줄이기·모션 끔에서는 안내 띠의 사라지는 애니메이션이 돌지 않으므로 직접 치운다.
    const timer = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, []);

  /** 관제실(시상식)과 커뮤니티 카페(케이크 배달)는 모든 운영실이 끝났을 때 파티를 연다. */
  const partyOf = (kind: RoomKind) => kind === "control" || kind === "community"
    ? state.allClear : (state.rooms as RoomKind[]).includes(kind);
  const kickoffOf = (kind: RoomKind) => kind === "control" ? kickoff.allClear : (kickoff.rooms as RoomKind[]).includes(kind);
  return { state, partyOf, kickoffOf, toast };
}
