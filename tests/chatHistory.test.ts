import { describe, expect, it } from "vitest";
import { historyFor, type TurnsByItem } from "../src/ui/chatHistory";
import type { Answer } from "../src/api/knowledge";

const answer = (text: string): Answer => ({ answer: text, suggested_checks: [], citations: [], warnings: [], cache_hit: false });

describe("항목별 대화 기록 (F2009)", () => {
  const turns: TurnsByItem = {
    "curl-28": [{ question: "A1", result: answer("A1 답") }, { question: "A2", error: "실패" }],
    "linux-errno-ENOSPC": [{ question: "B1", result: answer("B1 답") }],
  };

  it("선택한 항목의 완료된 대화만 맥락으로 보낸다", () => {
    expect(historyFor(turns, "linux-errno-ENOSPC")).toEqual([
      { role: "user", content: "B1" }, { role: "assistant", content: "B1 답" },
    ]);
    const json = JSON.stringify(historyFor(turns, "linux-errno-ENOSPC"));
    expect(json).not.toContain("A1");
  });

  it("오류난 질문은 빼고, 처음 고른 항목은 빈 맥락이다", () => {
    expect(historyFor(turns, "curl-28")).toHaveLength(2);
    expect(historyFor(turns, "aws-alb-http-503-issues")).toEqual([]);
  });

  it("최근 대화 수를 제한한다", () => {
    const many: TurnsByItem = { x: Array.from({ length: 8 }, (_, i) => ({ question: `q${i}`, result: answer(`a${i}`) })) };
    const history = historyFor(many, "x");
    expect(history).toHaveLength(10);
    expect(history[0].content).toBe("q3");
  });
});
