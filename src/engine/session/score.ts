/**
 * 점수 계산.
 *
 * 감점 방식을 쓴 이유: 플레이어가 "무엇 때문에 깎였는지"를 바로 알 수 있어야
 * 다음 판에 고칠 수 있기 때문이다. 점수 자체보다 이 피드백이 목적이다.
 */
import { elapsedSeconds, type Session } from "./session";

/** 이 명령어 수까지는 감점하지 않는다. 충분히 둘러볼 여유를 준다. */
const FREE_COMMANDS = 12;

export interface ScoreBreakdown {
  base: number;
  timePenalty: number;
  commandPenalty: number;
  hintPenalty: number;
  wrongPenalty: number;
  total: number;
  grade: "S" | "A" | "B" | "C" | "D";
  elapsedSeconds: number;
}

export function calculateScore(session: Session, now: number = Date.now()): ScoreBreakdown {
  const seconds = elapsedSeconds(session, now);

  // 1분에 10점, 최대 200점까지만 깎는다. 오래 걸렸다고 0점이 되면 학습 의욕이 꺾인다.
  const timePenalty = Math.min(200, Math.floor(seconds / 60) * 10);
  const commandPenalty = Math.min(150, Math.max(0, session.commands.length - FREE_COMMANDS) * 5);
  const hintPenalty = session.hintsUsed * 60;
  const wrongPenalty = session.wrongAnswers.length * 80;

  const base = 1000;
  const total = Math.max(0, base - timePenalty - commandPenalty - hintPenalty - wrongPenalty);

  return {
    base,
    timePenalty,
    commandPenalty,
    hintPenalty,
    wrongPenalty,
    total,
    grade: gradeOf(total),
    elapsedSeconds: seconds,
  };
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
