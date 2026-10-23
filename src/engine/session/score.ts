/**
 * 점수 계산.
 *
 * 감점 방식을 쓴 이유: 플레이어가 "무엇 때문에 깎였는지"를 바로 알 수 있어야
 * 다음 판에 고칠 수 있기 때문이다. 점수 자체보다 이 피드백이 목적이다.
 */
import { elapsedSeconds, type Session } from "./session";

/**
 * 힌트 단계별 감점. 뒤 단계 힌트일수록 정답에 가까운 내용을 알려 주므로 더 많이 깎는다(3단계 = "거의 정답").
 * 시나리오에 힌트가 더 있으면 마지막 값을 계속 쓴다.
 */
export const HINT_PENALTIES = [80, 100, 120] as const;
export const WRONG_PENALTY = 80;

/** n번째(0부터) 힌트를 열면 깎이는 점수. 힌트 버튼에 미리 보여 줄 때도 쓴다. */
export function hintPenaltyAt(index: number): number {
  return HINT_PENALTIES[Math.min(index, HINT_PENALTIES.length - 1)];
}

export interface ScoreBreakdown {
  base: number;
  hintPenalty: number;
  wrongPenalty: number;
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
  /** 걸린 시간·명령 수는 기록으로만 보여 준다(점수에 넣지 않는다). */
  elapsedSeconds: number;
}

/**
 * 연습 모드 점수. 걸린 시간과 친 명령 수는 감점하지 않는다 — 천천히 둘러보며 배우는 것이 목적이라,
 * 시간에 쫓기거나 명령을 아끼느라 확인을 건너뛰면 오히려 학습에 해롭다. 시간 경쟁은 나중의 챌린지 모드에서 다룬다.
 * 감점은 "도움을 받은 만큼(힌트)"과 "잘못 단정한 만큼(오답)"만.
 */
export function calculateScore(session: Session, now: number = Date.now()): ScoreBreakdown {
  const hintPenalty = Array.from({ length: session.hintsUsed }, (_, i) => hintPenaltyAt(i)).reduce((sum, n) => sum + n, 0);
  const wrongPenalty = session.wrongAnswers.length * WRONG_PENALTY;
  const base = 1000;
  const total = Math.max(0, base - hintPenalty - wrongPenalty);
  return { base, hintPenalty, wrongPenalty, total, grade: gradeOf(total), elapsedSeconds: elapsedSeconds(session, now) };
}

function gradeOf(total: number): ScoreBreakdown["grade"] {
  if (total >= 900) return "S";
  if (total >= 750) return "A";
  if (total >= 600) return "B";
  if (total >= 400) return "C";
  return "D";
}

/** "5분 12초" 처럼 사람이 읽는 형식 */
export function formatDuration(seconds: number): string {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return min > 0 ? `${min}분 ${sec}초` : `${sec}초`;
}
