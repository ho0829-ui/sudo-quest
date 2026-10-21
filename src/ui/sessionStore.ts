/**
 * 진행 중인 실습을 탭 단위(sessionStorage)로 보관한다.
 * 근거 링크를 눌러 페이지를 떠났다가 돌아오거나 새로고침해도 실습이 그대로 이어지게 한다.
 *
 * 상태(state)를 통째로 저장하지 않고 입력한 명령만 저장한 뒤 엔진에 다시 실행해 되살린다.
 * 엔진은 같은 입력에 같은 결과를 내므로(시각은 세션 시작 시각 기준) 저장 크기가 작고,
 * 시나리오 코드가 바뀌어도 오래된 상태 객체가 섞이지 않는다.
 */
import type { Scenario } from "../engine/scenario/types";
import { createSession, execute, type Session } from "../engine/session/session";

export interface SavedSession {
  scenarioId: string;
  startedAt: number;
  inputs: string[];
  hintsUsed: number;
  wrongAnswers: string[];
  causeSolved: boolean;
  finishedAt?: number;
}

const KEY = "incident-game/active-session";

export function serializeSession(session: Session): SavedSession {
  return {
    scenarioId: session.scenario.id,
    startedAt: session.startedAt,
    inputs: session.lines.map((line) => line.input),
    hintsUsed: session.hintsUsed,
    wrongAnswers: session.wrongAnswers,
    causeSolved: session.causeSolved,
    finishedAt: session.finishedAt,
  };
}

function isSaved(value: unknown): value is SavedSession {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.scenarioId === "string" && typeof v.startedAt === "number"
    && Array.isArray(v.inputs) && v.inputs.every((i) => typeof i === "string")
    && typeof v.hintsUsed === "number" && Array.isArray(v.wrongAnswers) && typeof v.causeSolved === "boolean";
}

/** 저장본을 엔진에 다시 실행해 세션을 되살린다. 시나리오가 없거나 손상됐으면 null. */
export function restoreSession(saved: unknown, scenarios: Scenario[]): Session | null {
  if (!isSaved(saved)) return null;
  const scenario = scenarios.find((s) => s.id === saved.scenarioId);
  if (!scenario) return null;
  let session = createSession(scenario, saved.startedAt);
  for (const input of saved.inputs) session = execute(session, input, saved.finishedAt ?? saved.startedAt);
  return {
    ...session,
    hintsUsed: Math.min(Math.max(0, saved.hintsUsed), scenario.hints.length),
    wrongAnswers: saved.wrongAnswers.filter((id) => typeof id === "string"),
    causeSolved: saved.causeSolved,
    finishedAt: saved.finishedAt,
  };
}

/** 저장소가 막혀 있어도(사생활 보호 모드 등) 게임은 계속되어야 하므로 실패는 조용히 넘긴다. */
export function saveActiveSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(serializeSession(session)));
    else sessionStorage.removeItem(KEY);
  } catch { /* 저장 실패는 무시한다 */ }
}

export function loadActiveSession(scenarios: Scenario[]): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? restoreSession(JSON.parse(raw), scenarios) : null;
  } catch {
    return null;
  }
}
