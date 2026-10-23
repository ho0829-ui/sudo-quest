import { describe, expect, it } from "vitest";
import { formatAnswer, parseInline } from "../src/ui/answerFormat";

describe("코치 답변 서식", () => {
  it("제목·목록·문단을 나누고 빈 줄은 버린다", () => {
    const blocks = formatAnswer("### 확인된 사실\n- 사용률 100% [실습 기록 2]\n\n1. 첫째\n일반 문장");
    expect(blocks.map(b => b.kind)).toEqual(["heading", "bullet", "bullet", "para"]);
    expect(blocks[0].parts).toEqual([{ kind: "text", text: "확인된 사실" }]);
  });

  it("코드와 출처 표시를 따로 고르고 **강조** 기호는 지운다", () => {
    expect(parseInline("**주의** `df -h`에서 [근거 3] 확인")).toEqual([
      { kind: "text", text: "주의 " }, { kind: "code", text: "df -h" }, { kind: "text", text: "에서 " },
      { kind: "cite", text: "근거 3" }, { kind: "text", text: " 확인" },
    ]);
  });

  it("HTML 태그는 해석하지 않고 글자로 남긴다", () => {
    expect(parseInline("<img src=x onerror=alert(1)>")).toEqual([{ kind: "text", text: "<img src=x onerror=alert(1)>" }]);
  });
});
