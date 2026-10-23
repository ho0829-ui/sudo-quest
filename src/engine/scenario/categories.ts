/**
 * 실습 분류 목록. 엔진은 분류의 "id"만 안다(화면 이름·색·방 배치는 UI가 정한다).
 *
 * 새 분류를 더할 때는 여기에 id를 한 줄 넣는다. Category 타입이 이 목록에서 만들어지므로,
 * UI 레지스트리(src/ui/categories.ts)·방 색(themes.ts)·방 그림(RoomArt.tsx)을 빠뜨리면
 * 컴파일이 실패해 바로 알 수 있다. 자세한 순서는 docs/SCENARIO_GUIDE.md "새 분류 추가".
 */
// docker·kubernetes는 캠퍼스 방을 먼저 열어 둔 "준비 중" 분류다(시나리오 0개, UI 레지스트리의 comingSoon).
export const CATEGORY_IDS = ["linux", "network", "web-db", "aws", "docker", "kubernetes"] as const;

export type Category = (typeof CATEGORY_IDS)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}
