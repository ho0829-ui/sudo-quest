/**
 * 홈의 "다음 실습" 버튼이 열 실습. 이미 해결한 실습으로 보내지 않는다.
 * - 풀지 않은 실습이 있으면: 목록 순서(입문 → 고급, 분류별 흐름)에서 가장 앞의 미해결 실습.
 *   중간 실습을 먼저 풀었어도 앞쪽에 남은 실습부터 채운다.
 * - 모두 해결했으면: 같은 "다음 실습"이라고 하지 않고, 최고 점수가 가장 낮은 실습을 "기록 갱신"으로 권한다.
 */
import type { Scenario } from "../engine/scenario/types";
import type { Progress } from "./storage";

export interface NextMission {
  scenario: Scenario;
  /** first: 아직 하나도 안 풂, next: 다음 미해결, improve: 모두 해결 → 점수 올리기 */
  kind: "first" | "next" | "improve";
  label: string;
}

export function nextMission(scenarios: Scenario[], progress: Progress): NextMission | null {
  if (!scenarios.length) return null;
  const solved = (s: Scenario) => !!progress[s.id]?.cleared;
  const unsolved = scenarios.find(s => !solved(s));
  if (unsolved) {
    const first = !scenarios.some(solved);
    return { scenario: unsolved, kind: first ? "first" : "next", label: first ? "첫 장애 해결하기" : "다음 실습 시작" };
  }
  // 점수가 같으면 목록에서 앞쪽 실습(정렬은 안정적이라 원래 순서가 유지된다).
  const lowest = [...scenarios].sort((a, b) => progress[a.id].bestScore - progress[b.id].bestScore)[0];
  return { scenario: lowest, kind: "improve", label: `최고 점수 갱신하기 · ${progress[lowest.id].bestScore}점` };
}
