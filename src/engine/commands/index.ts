/**
 * 명령어 레지스트리.
 *
 * 새 명령어를 만들면 여기에 한 줄만 추가하면 된다.
 * 시나리오는 이 중에서 쓸 수 있는 것만 골라 화이트리스트로 지정한다.
 */
import { aws } from "./aws";
import { cat, cd, ls, pwd, rm, tail } from "./files";
import { curl, ss, ufw } from "./network";
import { nginx } from "./nginx";
import { df, du, journalctl, makeHelp, systemctl } from "./system";
import { sed } from "./text";
import type { Command } from "./types";

const list: Command[] = [
  ls, cat, cd, pwd, tail, rm, sed,
  df, du, systemctl, journalctl,
  curl, ss, ufw, nginx,
  aws,
];

const registry = new Map<string, Command>(list.map((c) => [c.name, c]));

// help는 다른 명령어들을 알아야 하므로 레지스트리가 만들어진 뒤에 등록한다
const help = makeHelp((name) => registry.get(name));
registry.set(help.name, help);

export function getCommand(name: string): Command | undefined {
  return registry.get(name);
}

/** 시나리오가 commands를 지정하지 않으면 쓰이는 기본 명령어 묶음 (리눅스 기본) */
export const DEFAULT_COMMANDS = [
  "help", "ls", "cat", "cd", "pwd", "tail", "df", "du", "rm", "systemctl", "journalctl",
];

/** 기본 묶음에 시나리오별 명령어를 더한다. 시나리오 파일에서 쓴다. */
export function withCommands(...extra: string[]): string[] {
  return [...DEFAULT_COMMANDS, ...extra];
}

export type { Command, CommandContext, CommandResult } from "./types";
