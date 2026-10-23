import { describe, expect, it } from "vitest";
import { coachNudge, HYPOTHESIS_TEMPLATE, quickPrompts, runnableCommands } from "../src/ui/coachPrompts";
import { DEFAULT_COMMANDS } from "../src/engine/commands";
import { createSession } from "../src/engine/session/session";
import { execute } from "../src/engine/session/execute";
import { scenarios } from "../src/scenarios";

const T0 = 1_000_000_000_000;

describe("빠른 질문", () => {
  it("명령을 실행하기 전에는 마지막 출력 해석을 막는다", () => {
    const prompts = quickPrompts(createSession(scenarios[0], T0));
    expect(prompts.map(p => p.id)).toEqual(["summary", "next", "explain", "hypothesis"]);
    expect(prompts.find(p => p.id === "explain")!.disabled).toBe(true);
  });

  it("마지막으로 직접 입력한 명령만 질문에 넣는다", () => {
    let session = createSession(scenarios[0], T0);
    session = execute(session, "pwd", T0);
    session = execute(session, "df -h", T0);
    session = execute(session, "   ", T0); // 빈 입력은 건너뛴다
    const explain = quickPrompts(session).find(p => p.id === "explain")!;
    expect(explain.disabled).toBe(false);
    expect(explain.question).toContain("`df -h`");
  });

  it("가설 점검은 바로 보내지 않고 입력창에 채운다", () => {
    const hypothesis = quickPrompts(createSession(scenarios[0], T0)).find(p => p.id === "hypothesis")!;
    expect(hypothesis.draft).toBe(true);
    expect(hypothesis.question).toBe(HYPOTHESIS_TEMPLATE);
    expect(HYPOTHESIS_TEMPLATE.slice(0, 6)).toBe("내 가설: "); // 커서 위치(6)와 맞아야 한다
  });

  for (const scenario of scenarios) {
    it(`${scenario.id}: 질문 문장에 정답 보기·풀이가 들어가지 않는다`, () => {
      const session = execute(createSession(scenario, T0), "help", T0);
      const text = quickPrompts(session).map(p => p.question).join("\n");
      expect(text).not.toContain(scenario.rootCause.answerId);
      for (const choice of scenario.rootCause.choices) expect(text).not.toContain(choice.label);
      for (const step of scenario.solutionPath) if (step !== "help") expect(text).not.toContain(step);
    });
  }
});

describe("제안 명령을 터미널로 옮기기", () => {
  it("지원하는 명령만 고르고 sudo 접두사를 허용한다", () => {
    const check = "`df -h`로 사용률을 보고 `sudo journalctl -u nginx -n 20` 로그를 확인 [실습 기록 1]";
    expect(runnableCommands(check, DEFAULT_COMMANDS)).toEqual(["df -h", "sudo journalctl -u nginx -n 20"]);
  });

  it("지원하지 않는 명령·리다이렉션·명령 연결은 옮기지 않는다", () => {
    const check = "`lsof +L1` (실제 환경 참고), `journalctl -u nginx | lsof`, `cat a > b`, `ls; rm -rf /`";
    expect(runnableCommands(check, DEFAULT_COMMANDS)).toEqual([]);
    // 파이프는 단계마다 지원하는 명령이면 옮길 수 있다.
    expect(runnableCommands("`journalctl -u nginx | grep -i error`", DEFAULT_COMMANDS)).toEqual(["journalctl -u nginx | grep -i error"]);
  });

  it("같은 명령은 한 번만, 백틱이 없으면 아무것도 고르지 않는다", () => {
    expect(runnableCommands("`df -h` 다시 `df -h`", DEFAULT_COMMANDS)).toEqual(["df -h"]);
    expect(runnableCommands("df -h 를 실행해 보세요", DEFAULT_COMMANDS)).toEqual([]);
    expect(runnableCommands("`sudo`", DEFAULT_COMMANDS)).toEqual([]);
  });
});

describe("코치 권유", () => {
  it("마지막 질문 뒤 오답이 있으면 정리를 권한다", () => {
    expect(coachNudge(1, 0)?.promptId).toBe("summary");
  });
  it("명령을 6번 이상 실행하면 권하고, 그 전에는 조용하다", () => {
    expect(coachNudge(0, 5)).toBeNull();
    expect(coachNudge(0, 6)?.promptId).toBe("summary");
  });
});
