/** docker 하위 명령이 함께 쓰는 옵션 읽기·표·오류 문장. 문장은 실제 docker CLI와 같게 맞춘다. */
import { parseFlags, type FlagSpec, type Parsed } from "../flags";
import { fail, type CommandResult } from "../types";

/** docker CLI의 표: 열 사이를 공백 3칸 이상 띄운다(tabwriter와 같은 모양). */
export function dockerTable(rows: string[][]): string {
  const widths = rows[0].map((_, col) => Math.max(...rows.map(r => (r[col] ?? "").length)));
  return rows.map(row => row.map((cell, col) => col === row.length - 1 ? cell : cell.padEnd(widths[col] + 3)).join("").trimEnd()).join("\n");
}

/**
 * 옵션을 읽는다. -aq처럼 붙여 쓴 한 글자 스위치도 풀어 준다.
 * 실패하면 실제 docker처럼 "See 'docker ps --help'."를 붙이고 종료 코드 125를 낸다.
 */
export function dockerFlags(tokens: string[], spec: FlagSpec, command: string): Extract<Parsed, { ok: true }> | { ok: false; result: CommandResult } {
  const singles = new Set(Object.keys(spec.switches ?? {}).filter(name => name.length === 1));
  const expanded = tokens.flatMap(token => /^-[A-Za-z]{2,}$/.test(token) && [...token.slice(1)].every(ch => singles.has(ch))
    ? [...token.slice(1)].map(ch => `-${ch}`) : [token]);
  const parsed = parseFlags(expanded, spec);
  if (parsed.ok) return parsed;
  return { ok: false, result: fail(`${parsed.error.replace(/^error: /, "")}\nSee 'docker ${command} --help'.`, 125) };
}

export const noSuchContainer = (name: string) => `Error response from daemon: No such container: ${name}`;

/** "requires at least 1 argument" 같은 인자 개수 오류 */
export function argsError(command: string, usage: string, need: string): CommandResult {
  return fail(`"docker ${command}" requires ${need}.\nSee 'docker ${command} --help'.\n\nUsage:  docker ${usage}`, 1);
}
