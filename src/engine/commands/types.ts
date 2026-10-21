import type { SystemState } from "../state/types";

export interface CommandContext {
  /** 명령어는 이 상태를 마음껏 바꿔도 된다. 이미 복사된 사본이다. (run.ts 참고) */
  state: SystemState;
  /** 명령어 이름을 뺀 토큰들 */
  tokens: string[];
  /** sudo로 실행했는가 */
  sudo: boolean;
  /** 이 명령이 실제로 실행되는 사용자. sudo면 "root" */
  user: string;
  /** help 명령이 목록을 만들 때 쓴다 */
  available: string[];
  /** 파이프 앞 명령의 출력. 파일 인자가 없을 때 grep·head·tail·sort·wc·cat이 읽는다. */
  stdin?: string;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  /** 0 = 성공. 실제 셸과 같은 의미 */
  exitCode: number;
}

export interface Command {
  name: string;
  /** help에 한 줄로 표시되는 설명 */
  summary: string;
  usage: string;
  /**
   * 하위 명령을 가진 명령이 지원하는 경로. 예: aws의 "elbv2 describe-target-groups".
   * 코치가 지원하지 않는 하위 명령을 제안하지 않게 할 때 쓴다. 없으면 하위 명령을 따지지 않는다.
   */
  operations?: readonly string[];
  run(ctx: CommandContext): CommandResult;
}

export const ok = (stdout = ""): CommandResult => ({ stdout, stderr: "", exitCode: 0 });
export const fail = (stderr: string, exitCode = 1): CommandResult => ({ stdout: "", stderr, exitCode });
