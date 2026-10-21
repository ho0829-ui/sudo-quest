/**
 * 항목별 대화 기록(F2009).
 *
 * 대화는 item_id를 키로 따로 보관하고, 질문할 때는 그 항목의 완료된 대화만 보낸다.
 * 다른 항목의 질문·답변이 근거나 맥락으로 섞이지 않게 하려는 것이다.
 */
import type { Answer, Message } from "../api/knowledge";

export type Turn = { question: string; result?: Answer; error?: string };
export type TurnsByItem = Record<string, Turn[]>;

/** 이 항목에서 답변까지 완료된 최근 대화만 이전 맥락으로 만든다(오류·진행 중인 질문 제외). */
export function historyFor(turns: TurnsByItem, itemId: string, limit = 5): Message[] {
  return (turns[itemId] ?? []).filter(turn => turn.result).slice(-limit).flatMap(turn => [
    { role: "user" as const, content: turn.question },
    { role: "assistant" as const, content: turn.result!.answer },
  ]);
}
