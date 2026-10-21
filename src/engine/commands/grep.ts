/**
 * grep: 패턴이 들어 있는 줄을 찾는다. 로그에서 오류를 거르는 가장 흔한 도구라 파이프와 함께 지원한다.
 * 지원: -i(대소문자 무시) -v(반대로) -n(줄 번호) -c(개수) -l(파일 이름만) -r(디렉터리 아래 전부) -E(확장 정규식)
 *       -A/-B/-C N(찾은 줄 뒤·앞·양쪽 N줄. kubectl describe에서 Last State 아래 줄을 볼 때 흔히 쓴다)
 * 종료 코드는 실제 grep처럼 찾으면 0, 못 찾으면 1, 오류가 있으면 2다.
 */
import { hasFlag, positionals } from "../parser/parse";
import { linesOf, readSources } from "./input";
import { type Command, type CommandContext } from "./types";

const BRE_LITERALS = "+?|(){}";

/**
 * 기본 정규식(BRE)을 JS 정규식으로 바꾼다. BRE에서는 + ? | ( ) { } 가 글자이고,
 * 앞에 \ 를 붙여야 특수 기호가 된다(GNU grep과 같다). -E면 그대로 쓴다.
 */
export function basicToJs(pattern: string): string {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "\\" && i + 1 < pattern.length) {
      const next = pattern[++i];
      out += BRE_LITERALS.includes(next) ? next : `\\${next}`;
    } else {
      out += BRE_LITERALS.includes(ch) ? `\\${ch}` : ch;
    }
  }
  return out;
}

/**
 * -A N / -A2 / --after-context=N 같은 문맥 옵션을 먼저 떼어 낸다.
 * 값이 다음 토큰으로 오면(-A 2) 그 숫자가 패턴으로 잘못 읽히지 않게 함께 뺀다.
 */
function takeContext(tokens: string[]): { rest: string[]; before: number; after: number } | { error: string } {
  const rest: string[] = [];
  let before = 0;
  let after = 0;
  for (let i = 0; i < tokens.length; i++) {
    const short = /^-([ABC])(.*)$/.exec(tokens[i]);
    const long = /^--(after-context|before-context|context)=(.*)$/.exec(tokens[i]);
    if (!short && !long) { rest.push(tokens[i]); continue; }
    const kind = short ? short[1] : { "after-context": "A", "before-context": "B", context: "C" }[long![1]]!;
    const value = short ? (short[2] || tokens[++i]) : long![2];
    if (value === undefined || !/^\d+$/.test(value)) return { error: `grep: ${value ?? ""}: invalid context length argument` };
    const n = Number(value);
    if (kind !== "B") after = n;
    if (kind !== "A") before = n;
  }
  return { rest, before, after };
}

export const grep: Command = {
  name: "grep",
  summary: "패턴이 들어 있는 줄을 찾는다 (-i -v -n -c -l -r -E -A -B -C)",
  usage: "grep [-ivnclrE] [-A N] [-B N] [-C N] <패턴> [파일...]",
  run(ctx: CommandContext) {
    const context = takeContext(ctx.tokens);
    if ("error" in context) return { stdout: "", stderr: context.error, exitCode: 2 };
    const tokens = context.rest;
    const [pattern, ...paths] = positionals(tokens);
    if (pattern === undefined) {
      return { stdout: "", stderr: "Usage: grep [OPTION]... PATTERNS [FILE]...\nTry 'grep --help' for more information.", exitCode: 2 };
    }
    const ignoreCase = hasFlag(tokens, "i", "ignore-case");
    const invert = hasFlag(tokens, "v", "invert-match");
    const numbered = hasFlag(tokens, "n", "line-number");
    const countOnly = hasFlag(tokens, "c", "count");
    const namesOnly = hasFlag(tokens, "l", "files-with-matches");
    const recursive = hasFlag(tokens, "r", "recursive") || hasFlag(tokens, "R");
    const extended = hasFlag(tokens, "E", "extended-regexp");

    let regex: RegExp;
    try {
      regex = new RegExp(extended ? pattern : basicToJs(pattern), ignoreCase ? "i" : "");
    } catch {
      return { stdout: "", stderr: "grep: Unmatched ( or \\(", exitCode: 2 };
    }

    // -r에 경로가 없으면 실제 grep처럼 현재 디렉터리를 뒤진다.
    const targets = recursive && paths.length === 0 ? ["."] : paths;
    const { sources, errors } = readSources(ctx, "grep", targets, recursive);
    const showName = sources.length > 1 || recursive;
    const out: string[] = [];
    let matched = false;

    for (const source of sources) {
      const all = linesOf(source.text);
      const hits = all
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => regex.test(line) !== invert);
      if (hits.length) matched = true;
      const prefix = showName && source.name ? `${source.name}:` : "";
      if (!namesOnly && !countOnly && (context.before || context.after)) {
        const name = showName ? source.name ?? undefined : undefined;
        out.push(...withContext(all, new Set(hits.map(h => h.number - 1)), context, name, numbered));
        continue;
      }
      if (namesOnly) {
        if (hits.length) out.push(source.name ?? "(standard input)");
      } else if (countOnly) {
        out.push(`${prefix}${hits.length}`);
      } else {
        for (const hit of hits) out.push(`${prefix}${numbered ? `${hit.number}:` : ""}${hit.line}`);
      }
    }

    const exitCode = errors.length ? 2 : matched ? 0 : 1;
    return { stdout: out.join("\n"), stderr: errors.join("\n"), exitCode };
  },
};

/** 찾은 줄 앞뒤 문맥. 찾은 줄은 "번호:", 문맥 줄은 "번호-", 이어지지 않는 묶음 사이에는 "--". */
function withContext(lines: string[], hits: Set<number>, ctx: { before: number; after: number }, name: string | undefined, numbered: boolean): string[] {
  const show = new Set<number>();
  for (const i of hits) for (let j = Math.max(0, i - ctx.before); j <= Math.min(lines.length - 1, i + ctx.after); j++) show.add(j);
  const out: string[] = [];
  let last = -2;
  for (const i of [...show].sort((a, b) => a - b)) {
    if (last >= 0 && i > last + 1) out.push("--");
    const mark = hits.has(i) ? ":" : "-";
    out.push(`${name ? name + mark : ""}${numbered ? `${i + 1}${mark}` : ""}${lines[i]}`);
    last = i;
  }
  return out;
}
