/**
 * 코치 요청 만들기.
 *
 * Session을 통째로 보내지 않고, 플레이어에게 이미 보이는 정보만 골라 새 객체를 만든다.
 * faults·rootCause·solutionPath·state·postmortem·학습 목표·아직 안 연 힌트는 절대 넣지 않는다.
 * (학습 목표에는 "df와 du로…"처럼 풀이가 들어 있어서 뺀다.)
 */
import { DEFAULT_COMMANDS } from "../engine/commands";
import type { Session } from "../engine/session/session";
import type { Citation, Message } from "./knowledge";

export const MAX_OBSERVATIONS = 30;
const LIMITS = { stdout: 4000, stderr: 2000 };

export interface Observation {
  command: string;
  stdout: string;
  stderr: string;
  exit_code: number;
  truncated: boolean;
}

export interface CoachRequest {
  session_id: string;
  question: string;
  ticket: string;
  revealed_hints: string[];
  observations: Observation[];
  omitted_observations: number;
  available_commands: string[];
  item_id: string | null;
  history: Message[];
}

export interface CoachAnswer {
  answer: string;
  suggested_checks: string[];
  citations: Citation[];
  observations: (Observation & { observation_id: number })[];
  warnings: string[];
  cache_hit: boolean;
}

/** 긴 출력은 앞뒤를 남기고 가운데를 몇 글자 뺐는지 적는다. 끝만 자르면 마지막 오류 줄이 사라진다. */
export function clip(text: string, limit: number): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  const marker = (n: number) => `\n...[중간 ${n}자 생략]...\n`;
  const keep = limit - marker(text.length).length;
  const head = Math.floor(keep * 0.55);
  const tail = keep - head;
  return { text: text.slice(0, head) + marker(text.length - head - tail) + text.slice(text.length - tail), truncated: true };
}

export function buildCoachRequest(
  session: Session, sessionId: string, question: string, itemId: string | null, history: Message[],
): CoachRequest {
  const typed = session.lines.filter(line => line.input.trim() !== "");
  const recent = typed.slice(-MAX_OBSERVATIONS);
  const observations = recent.map(line => {
    const stdout = clip(line.stdout, LIMITS.stdout);
    const stderr = clip(line.stderr, LIMITS.stderr);
    return { command: line.input.slice(0, 500), stdout: stdout.text, stderr: stderr.text,
      exit_code: line.exitCode, truncated: stdout.truncated || stderr.truncated };
  });
  return {
    session_id: sessionId,
    question,
    ticket: session.scenario.ticket,
    revealed_hints: session.scenario.hints.slice(0, session.hintsUsed),
    observations,
    omitted_observations: typed.length - recent.length,
    available_commands: session.scenario.commands ?? DEFAULT_COMMANDS,
    item_id: itemId,
    history: history.slice(-6),
  };
}
