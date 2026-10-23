/**
 * 힌트 용어 풀이: 사전 항목이 실제 힌트에 쓰이는지, 네트워크 실습 힌트에 풀이가 붙는지, 용어 찾기, 렌더링.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { scenarios } from "../src/scenarios";
import { tutorialScenario } from "../src/scenarios/tutorial-first-shift";
import { HintGlossary } from "../src/ui/components/HintGlossary";
import { GLOSSARY, termsIn } from "../src/ui/glossary";

const allHints = [...scenarios, tutorialScenario].flatMap(s => s.hints);
const terms = (text: string) => termsIn(text).map(t => t.term);

describe("힌트 용어 사전", () => {
  it("모든 항목이 어느 힌트에든 실제로 나온다(죽은 항목 없음), 이름이 겹치지 않는다", () => {
    for (const entry of GLOSSARY) expect(allHints.some(h => entry.pattern.test(h)), entry.term).toBe(true);
    expect(new Set(GLOSSARY.map(e => e.term)).size).toBe(GLOSSARY.length);
  });

  it("네트워크 실습은 힌트마다(첫 방향 질문 제외) 풀이가 붙고, 실습마다 세 개 이상이다", () => {
    for (const scenario of scenarios.filter(s => s.category === "network")) {
      for (const hint of scenario.hints.slice(1)) expect(terms(hint).length, hint).toBeGreaterThan(0);
      expect(new Set(scenario.hints.flatMap(terms)).size, scenario.id).toBeGreaterThanOrEqual(3);
    }
  });

  it("풀이는 일반적인 뜻만 쓴다: 실습의 고치는 명령(sudo …)이나 특정 사설 IP를 담지 않는다", () => {
    for (const entry of GLOSSARY) {
      expect(entry.plain, entry.term).not.toMatch(/sudo |10\.0\.0\.\d+/);
      expect(entry.plain.length, entry.term).toBeGreaterThan(20);
    }
  });
});

describe("용어 찾기", () => {
  it("나온 순서대로, 비슷한 숫자(10.0.0.0)는 0.0.0.0으로 잘못 잡지 않는다", () => {
    expect(terms("`ss -tlnp` 를 보세요. 127.0.0.1 과 0.0.0.0 의 차이")).toEqual(["ss -tlnp", "127.0.0.1 · localhost", "0.0.0.0"]);
    expect(terms("주소 10.0.0.0 대역")).not.toContain("0.0.0.0");
    expect(terms("서버 안에서는 멀쩡한데 밖에서만 안 된다면")).toEqual([]);
    expect(terms("dig가 connection timed out")).toEqual(["dig", "timeout과 거부(refused)"]);
  });

  it("용어가 있으면 펼침을 그리고, 없으면 아무것도 그리지 않는다", () => {
    const html = renderToStaticMarkup(<HintGlossary text="앱 로그의 EAI_AGAIN 이 무슨 뜻인지" />);
    expect(html).toContain("<details");
    expect(html).toContain("용어 풀이 · EAI_AGAIN");
    expect(renderToStaticMarkup(<HintGlossary text="요청이 서버까지 들어오기는 할까요?" />)).toBe("");
    // 앞 힌트에서 풀이한 용어는 되풀이하지 않는다.
    const later = renderToStaticMarkup(<HintGlossary text="`dig` 로 이름 해석을, `/etc/resolv.conf` 를" before="dig 로 이름 해석을 시도" />);
    expect(later).toContain("용어 풀이 · /etc/resolv.conf<");
    expect(renderToStaticMarkup(<HintGlossary text="dig 다시" before="dig 먼저" />)).toBe("");
  });
});
