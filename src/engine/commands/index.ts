/**
 * 명령어 레지스트리.
 *
 * 새 명령어를 만들면 여기에 한 줄만 추가하면 된다.
 * 시나리오는 이 중에서 쓸 수 있는 것만 골라 화이트리스트로 지정한다.
 */
import { aws } from "./aws";
import { dig, dmesg, free, kill, ping, ps } from "./diag";
import { cat, cd, ls, pwd, rm, tail } from "./files";
import { chmod, chown } from "./perms";
import { curl, ss, ufw } from "./network";
import { mysql } from "./mysql";
import { nginx } from "./nginx";
import { df, du, journalctl, makeHelp, systemctl } from "./system";
import { sed } from "./text";
import { grep } from "./grep";
import { head } from "./head";
import { sort } from "./sort";
import { wc } from "./wc";
import { certbot, openssl } from "./tls";
import type { Command } from "./types";

const list: Command[] = [
  ls, cat, cd, pwd, tail, head, grep, sort, wc, rm, sed, chmod, chown,
  df, du, systemctl, journalctl, free, ps, dmesg, kill,
  curl, ss, ufw, nginx, ping, dig, openssl, certbot,
  aws, mysql,
];

const registry = new Map<string, Command>(list.map((c) => [c.name, c]));

// help는 다른 명령어들을 알아야 하므로 레지스트리가 만들어진 뒤에 등록한다
const help = makeHelp((name) => registry.get(name));
registry.set(help.name, help);

export function getCommand(name: string): Command | undefined {
  return registry.get(name);
}

/** 사용 가능한 명령 중 하위 명령 목록이 있는 것만 모은다. 예: { aws: ["elbv2 describe-target-groups", ...] } */
export function commandOperations(available: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const name of available) {
    const operations = registry.get(name)?.operations;
    if (operations) result[name] = [...operations];
  }
  return result;
}

/**
 * 한 줄 명령을 이 실습에서 실행할 수 있는지(명령 이름과 하위 명령까지) 본다. 실행하지는 않는다.
 * 하위 명령은 옵션(-로 시작)을 건너뛴 앞쪽 단어로 비교한다. 옵션이 하위 명령보다 앞에 오면 보수적으로 false가 된다.
 */
export function supportsInvocation(line: string, available: string[]): boolean {
  const words = line.trim().split(/\s+/);
  if (words[0] === "sudo") words.shift();
  const name = words[0];
  if (!name || !available.includes(name)) return false;
  const operations = registry.get(name)?.operations;
  if (!operations) return true;
  const positional = words.slice(1).filter((word) => !word.startsWith("-"));
  return operations.some((op) => {
    const parts = op.split(" ");
    return parts.every((part, index) => positional[index] === part);
  });
}

/** 시나리오가 commands를 지정하지 않으면 쓰이는 기본 명령어 묶음 (리눅스 기본) */
export const DEFAULT_COMMANDS = [
  "help", "ls", "cat", "cd", "pwd", "tail", "head", "grep", "sort", "wc", "df", "du", "rm", "systemctl", "journalctl",
];

/** 기본 묶음에 시나리오별 명령어를 더한다. 시나리오 파일에서 쓴다. */
export function withCommands(...extra: string[]): string[] {
  return [...DEFAULT_COMMANDS, ...extra];
}

export type { Command, CommandContext, CommandResult } from "./types";
