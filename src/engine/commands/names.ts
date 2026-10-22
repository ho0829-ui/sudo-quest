/**
 * 시나리오가 쓰는 명령 이름 목록. 명령 구현(등록부)을 import하지 않는다.
 * 시나리오 파일은 홈 화면에서도 읽히므로, 여기서 등록부를 끌어오면 명령 구현 전체가 첫 화면 번들에 들어간다.
 */

/** 시나리오가 commands를 지정하지 않으면 쓰이는 기본 명령어 묶음 (리눅스 기본) */
export const DEFAULT_COMMANDS = [
  "help", "ls", "cat", "cd", "pwd", "tail", "head", "grep", "sort", "wc", "df", "du", "rm", "systemctl", "journalctl",
];

/** 기본 묶음에 시나리오별 명령어를 더한다. 시나리오 파일에서 쓴다. */
export function withCommands(...extra: string[]): string[] {
  return [...DEFAULT_COMMANDS, ...extra];
}

