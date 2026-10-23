import { DOMAIN_CAST, type NpcId, type QuestDomain } from './cast';

export const ENTRANCES = ['push', 'dolly', 'rise', 'focus', 'hologram'] as const;
export type Entrance = typeof ENTRANCES[number];
export const ENTRANCE_LABELS: Record<Entrance, string> = {
  push: '시네마틱 줌인', dolly: '사이드 트래킹', rise: '크레인 업', focus: '포커스 풀', hologram: '홀로그램 연결',
};
export interface QuestPresentation { npc: NpcId; entrance: Entrance; take: number }

/** 한 바퀴 동안 모두 보여 주고, 새 바퀴 경계에서도 같은 장면이 연속되지 않게 한다. */
export function createShuffleBag<T>(items: readonly T[], random: () => number = Math.random): () => T {
  if (!items.length) throw new Error('장면 목록은 비어 있을 수 없습니다.');
  let bag: T[] = [], previous: T;
  return () => {
    if (!bag.length) {
      bag = [...items];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag[bag.length - 1] === previous) {
        [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
      }
    }
    previous = bag.pop()!;
    return previous;
  };
}
const nextEntrance = createShuffleBag(ENTRANCES);
const nextNavigator = createShuffleBag(DOMAIN_CAST.kubernetes);
let take = 0;

/** 클릭 이벤트에서만 선택한다. React 재렌더·StrictMode가 랜덤 순서를 소모하지 않는다. */
export function nextPresentation(domain: QuestDomain): QuestPresentation {
  return { npc: domain === 'kubernetes' ? nextNavigator() : DOMAIN_CAST[domain][0], entrance: nextEntrance(), take: ++take };
}
