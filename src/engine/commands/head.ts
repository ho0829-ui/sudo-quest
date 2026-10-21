/**
 * head: 앞쪽 줄만 본다. 긴 출력을 잘라 보는 용도로 파이프 뒤에 자주 붙는다(`ps aux | head`).
 */
import { flagValue, positionals } from "../parser/parse";
import { lineCount, linesOf, readSources } from "./input";
import { fail, type Command, type CommandContext } from "./types";

export const head: Command = {
  name: "head",
  summary: "앞쪽 줄을 본다 (-n 줄수, 기본 10)",
  usage: "head [-n 줄수] [파일...]",
  run(ctx: CommandContext) {
    const { tokens } = ctx;
    const count = lineCount(tokens, flagValue(tokens, "n", "lines"), 10);
    if (count === null) return fail(`head: invalid number of lines: '${flagValue(tokens, "n", "lines")}'`);
    const paths = positionals(tokens, ["n", "lines"]);
    const { sources, errors } = readSources(ctx, "head", paths);
    const blocks = sources.map((source) => {
      const body = linesOf(source.text).slice(0, count).join("\n");
      return sources.length > 1 ? `==> ${source.name} <==\n${body}` : body;
    });
    return { stdout: blocks.join("\n\n"), stderr: errors.join("\n"), exitCode: errors.length ? 1 : 0 };
  },
};
