/**
 * 오픈 예정 실습. 아직 시나리오 파일이 없는 "예고"라서 엔진·판정·자동 검증 대상이 아니다.
 * 실습 목록의 잠긴 카드와 운영실 HUD에 보인다. 실제 시나리오를 만들면 여기서 지운다.
 * 티켓처럼 원인을 드러내지 않게, 증상 수준의 제목과 한 줄 소개만 적는다.
 */
import type { Category } from "../engine/scenario/categories";

export interface UpcomingScenario {
  category: Category;
  title: string;
  teaser: string;
}

export const upcomingScenarios: UpcomingScenario[] = [
  { category: "linux", title: "디스크는 남는데 파일이 안 만들어져요", teaser: "df로는 여유가 있는데 새 파일을 만들 수 없다는 오류" },
  { category: "linux", title: "밤마다 돌던 백업이 멈췄어요", teaser: "아무 오류 없이 어느 날부터 결과물이 생기지 않는 정기 작업" },
  { category: "network", title: "큰 파일만 업로드가 멈춰요", teaser: "작은 요청은 되는데 큰 요청만 중간에 끊기는 연결" },
  { category: "network", title: "새 서버만 시간이 어긋나요", teaser: "로그 시각과 인증 토큰이 자꾸 맞지 않는 서버" },
  { category: "web-db", title: "결제만 가끔 멈춰 섭니다", teaser: "특정 시간대에 주문 처리가 줄줄이 대기하는 DB" },
  { category: "web-db", title: "로그인하면 다른 사람 화면이 보인대요", teaser: "캐시 뒤에서 섞여 버린 사용자 응답" },
  { category: "aws", title: "새 도메인으로 접속이 안 돼요", teaser: "레코드는 만들었는데 이름이 풀리지 않는 도메인" },
  { category: "aws", title: "자동 확장이 서버를 계속 갈아치워요", teaser: "인스턴스가 떴다 사라지기를 반복하는 그룹" },
  { category: "docker", title: "컨테이너끼리 서로를 못 찾아요", teaser: "같은 서버의 컨테이너 사이 이름 해석 실패" },
  { category: "kubernetes", title: "새 파드가 계속 대기 중이에요", teaser: "스케줄되지 못하고 Pending에 머무는 워크로드" },
  { category: "kubernetes", title: "트래픽이 늘었는데 파드가 안 늘어요", teaser: "부하가 올라도 반응하지 않는 자동 확장" },
];

export function upcomingIn(category: Category): UpcomingScenario[] {
  return upcomingScenarios.filter(s => s.category === category);
}
