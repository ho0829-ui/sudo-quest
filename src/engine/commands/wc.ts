/**
 * wc: 줄·단어·바이트 수를 센다. `grep -c` 대신 `| wc -l`로 세는 습관이 흔하다.
 * 출력 형식은 GNU wc를 따른다. 숫자 하나만 낼 때(stdin + 옵션 하나)는 여백 없이 숫자만 쓴다.
 */
import { hasFlag, positionals } from "../parser/parse";
import { linesOf, readSources } from "./input";
import { type Command, type CommandContext } from "./types";

export const wc: Command = {
  name: "wc",
  summary: "줄·단어·바이트 수를 센다 (-l 줄, -w 단어, -c 바이트)",
  usage: "wc [-lwc] [파일...]",
  run(ctx: CommandContext) {
    const { tokens } = ctx;
    const picked = { l: hasFlag(tokens, "l", "lines"), w: hasFlag(tokens, "w", "words"), c: hasFlag(tokens, "c", "bytes") };
    const columns = picked.l || picked.w || picked.c ? (["l", "w", "c"] as const).filter((k) => picked[k]) : (["l", "w", "c"] as const);
    const { sources, errors } = readSources(ctx, "wc", positionals(tokens));

    const rows = sources.map((source) => {
      const counts = {
        // 실제 wc -l은 줄바꿈 문자 수를 센다. 마지막 줄에 줄바꿈이 없어도 줄로 쳐서 출력에 맞춘다.
        l: linesOf(source.text).length,
        w: source.text.split(/\s+/).filter(Boolean).length,
        c: new TextEncoder().encode(source.text).length,
      };
      return { name: source.name, values: columns.map((k) => counts[k]) };
    });
    if (rows.length > 1) rows.push({ name: "total", values: columns.map((_, i) => rows.reduce((sum, r) => sum + r.values[i], 0)) });

    const single = rows.length === 1 && columns.length === 1 && rows[0].name === null;
    const width = Math.max(1, ...rows.flatMap((r) => r.values.map((v) => String(v).length)));
    const stdout = rows
      .map((r) => (single ? String(r.values[0]) : [...r.values.map((v) => String(v).padStart(width)), ...(r.name ? [r.name] : [])].join(" ")))
      .join("\n");
    return { stdout, stderr: errors.join("\n"), exitCode: errors.length ? 1 : 0 };
  },
};
