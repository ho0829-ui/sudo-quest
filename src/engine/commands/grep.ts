/**
 * grep: 패턴이 들어 있는 줄을 찾는다. 로그에서 오류를 거르는 가장 흔한 도구라 파이프와 함께 지원한다.
 * 지원: -i(대소문자 무시) -v(반대로) -n(줄 번호) -c(개수) -l(파일 이름만) -r(디렉터리 아래 전부) -E(확장 정규식)
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

export const grep: Command = {
  name: "grep",
  summary: "패턴이 들어 있는 줄을 찾는다 (-i -v -n -c -l -r -E)",
  usage: "grep [-ivnclrE] <패턴> [파일...]",
  run(ctx: CommandContext) {
    const { tokens } = ctx;
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
      const hits = linesOf(source.text)
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(({ line }) => regex.test(line) !== invert);
      if (hits.length) matched = true;
      const prefix = showName && source.name ? `${source.name}:` : "";
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
