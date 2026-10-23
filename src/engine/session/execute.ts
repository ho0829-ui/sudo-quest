/**
 * 세션에서 명령 한 줄을 실행한다. 명령 구현 전체(run → commands)를 끌어오므로 session.ts와 나눠,
 * 실습 화면을 열 때만 불러오게 한다(코드 분할).
 */
import { runCommand } from "../run";
import { stampFinish, type Session } from "./session";

/** 명령어 한 줄을 실행하고 새 세션을 돌려준다. */
export function execute(session: Session, input: string, now: number = Date.now()): Session {
  const result = runCommand(session.state, input, { available: session.scenario.commands });

  const next: Session = {
    ...session,
    state: result.state,
    lines: [
      ...session.lines,
      {
        input,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        cwd: session.state.cwd, // 명령 실행 "전"의 위치
      },
    ],
    // 빈 입력은 기록하지 않는다 (엔터만 친 경우)
    commands: input.trim() ? [...session.commands, input.trim()] : session.commands,
  };

  return stampFinish(next, now);
}
