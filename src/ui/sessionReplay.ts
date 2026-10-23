/**
 * 저장해 둔 입력을 엔진에 다시 실행해 진행 중 실습을 되살린다.
 * 명령 구현 전체를 끌어오므로 App이 저장본이 있을 때만 불러온다(코드 분할). sessionStore.ts는 가벼운 저장·읽기만 한다.
 */
import type { Scenario } from "../engine/scenario/types";
import { execute } from "../engine/session/execute";
import { createSession, type Session } from "../engine/session/session";
import { isSaved } from "./sessionStore";

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
