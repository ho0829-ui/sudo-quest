/**
 * sort: 줄을 정렬한다. `du -sh /var/log/* | sort -h`처럼 큰 디렉터리를 찾는 데 자주 쓴다.
 * 지원: -n(숫자) -h(사람이 읽는 크기 1K 2M 3G) -r(거꾸로) -u(중복 제거)
 */
import { hasFlag, positionals } from "../parser/parse";
import { linesOf, readSources } from "./input";
import { type Command, type CommandContext } from "./types";

const UNITS = "KMGTP";

/** "5.9G" → 바이트 크기에 비례하는 수. 단위가 없으면 그대로 숫자. 숫자가 아니면 0(GNU sort처럼 맨 앞으로). */
export function humanValue(text: string): number {
  const match = text.trim().match(/^(-?[\d.]+)\s*([KMGTP])?/i);
  if (!match) return 0;
  const unit = match[2] ? UNITS.indexOf(match[2].toUpperCase()) + 1 : 0;
  return Number(match[1]) * 1024 ** unit;
}

function numberValue(text: string): number {
  const match = text.trim().match(/^-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

export const sort: Command = {
  name: "sort",
  summary: "줄을 정렬한다 (-n 숫자, -h 크기, -r 거꾸로, -u 중복 제거)",
  usage: "sort [-nhru] [파일...]",
  run(ctx: CommandContext) {
    const { tokens } = ctx;
    const { sources, errors } = readSources(ctx, "sort", positionals(tokens));
    let lines = sources.flatMap((source) => linesOf(source.text));
    const key = hasFlag(tokens, "h", "human-numeric-sort") ? humanValue : hasFlag(tokens, "n", "numeric-sort") ? numberValue : null;
    // 값이 같으면 글자 순서로 정렬해 결과가 항상 같게 한다.
    lines = [...lines].sort((a, b) => (key ? key(a) - key(b) : 0) || (a < b ? -1 : a > b ? 1 : 0));
    if (hasFlag(tokens, "r", "reverse")) lines.reverse();
    if (hasFlag(tokens, "u", "unique")) lines = lines.filter((line, i) => i === 0 || line !== lines[i - 1]);
    return { stdout: lines.join("\n"), stderr: errors.join("\n"), exitCode: errors.length ? 2 : 0 };
  },
};
