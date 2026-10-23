/**
 * 파일을 쓰는 셸 도구: echo, tee, mkdir. 화면 편집기가 없는 대신 실무에서 설정 파일을 만들 때 쓰는 방식이다.
 * 리다이렉션(>)은 셸 사용자 권한으로 열리므로, root 파일은 `echo ... | sudo tee 파일`로 써야 한다(실제와 같다).
 */
import { canWrite, ensureDir, isDir, lookup, splitLast, writeFile } from "../state/fs";
import { fail, ok, type Command, type CommandContext } from "./types";

/** echo -e가 해석하는 이스케이프. 없으면 백슬래시를 글자 그대로 둔다(bash 기본 echo와 같다). */
function unescape(text: string): string {
  return text.replace(/\\(n|t|\\)/g, (_, ch: string) => (ch === "n" ? "\n" : ch === "t" ? "\t" : "\\"));
}

export const echo: Command = {
  name: "echo",
  summary: "글자를 출력한다 (-e 이스케이프 해석, -n 줄바꿈 없음)",
  usage: "echo [-ne] [글자...]",
  run({ tokens }: CommandContext) {
    let index = 0;
    let escapes = false;
    // echo는 알 수 없는 옵션을 글자로 출력한다. -n·-e·-ne 같은 앞쪽 옵션만 옵션으로 본다.
    while (index < tokens.length && /^-[neE]+$/.test(tokens[index])) {
      if (tokens[index].includes("e")) escapes = true;
      index++;
    }
    const text = tokens.slice(index).join(" ");
    return ok(escapes ? unescape(text) : text);
  },
};

/** 새 파일을 만들거나 기존 파일을 쓸 수 있는지. 실패하면 tee 형식의 오류 이유. */
function writable(ctx: CommandContext, path: string): { abs: string } | { error: string } {
  const { abs, node } = lookup(ctx.state, path);
  if (node && isDir(node)) return { error: "Is a directory" };
  if (node) return canWrite(node, ctx.user) ? { abs } : { error: "Permission denied" };
  const parent = lookup(ctx.state, splitLast(abs).parent).node;
  if (!parent || !isDir(parent)) return { error: "No such file or directory" };
  return canWrite(parent, ctx.user) ? { abs } : { error: "Permission denied" };
}

export const tee: Command = {
  name: "tee",
  summary: "입력을 화면과 파일에 함께 쓴다 (-a 이어쓰기)",
  usage: "tee [-a] <파일...>",
  run(ctx: CommandContext) {
    const append = ctx.tokens.some(t => t === "-a" || t === "--append");
    const unknown = ctx.tokens.find(t => t.startsWith("-") && t !== "-a" && t !== "--append");
    if (unknown) return fail(`tee: invalid option -- '${unknown.replace(/^-+/, "")}'\nTry 'tee --help' for more information.`);
    const input = ctx.stdin ?? "";
    const errors: string[] = [];
    for (const path of ctx.tokens.filter(t => !t.startsWith("-"))) {
      const target = writable(ctx, path);
      if ("error" in target) { errors.push(`tee: ${path}: ${target.error}`); continue; }
      const { node } = lookup(ctx.state, target.abs);
      const before = append && node?.kind === "file" ? node.content : "";
      writeFile(ctx.state.fs, target.abs, {
        content: `${before}${input}\n`, mtime: ctx.state.clock,
        owner: node?.owner ?? ctx.user, group: node?.group ?? ctx.user, mode: node?.mode ?? 0o644,
      });
    }
    return { stdout: input, stderr: errors.join("\n"), exitCode: errors.length ? 1 : 0 };
  },
};

export const mkdir: Command = {
  name: "mkdir",
  summary: "디렉터리를 만든다 (-p 상위까지 한 번에)",
  usage: "mkdir [-p] <디렉터리...>",
  run(ctx: CommandContext) {
    const parents = ctx.tokens.some(t => t === "-p" || t === "--parents");
    const unknown = ctx.tokens.find(t => t.startsWith("-") && t !== "-p" && t !== "--parents");
    if (unknown) return fail(`mkdir: invalid option -- '${unknown.replace(/^-+/, "")}'\nTry 'mkdir --help' for more information.`);
    const paths = ctx.tokens.filter(t => !t.startsWith("-"));
    if (!paths.length) return fail("mkdir: missing operand\nTry 'mkdir --help' for more information.");
    const errors: string[] = [];
    for (const path of paths) {
      const { abs, node } = lookup(ctx.state, path);
      if (node) {
        if (!parents || !isDir(node)) errors.push(`mkdir: cannot create directory ‘${path}’: File exists`);
        continue;
      }
      // 이미 있는 가장 가까운 상위 디렉터리에 쓸 수 있어야 만들 수 있다.
      let existing = splitLast(abs).parent;
      while (!lookup(ctx.state, existing).node) {
        if (!parents) { errors.push(`mkdir: cannot create directory ‘${path}’: No such file or directory`); existing = ""; break; }
        existing = splitLast(existing).parent;
      }
      if (!existing) continue;
      const base = lookup(ctx.state, existing).node!;
      if (!isDir(base) || !canWrite(base, ctx.user)) { errors.push(`mkdir: cannot create directory ‘${path}’: Permission denied`); continue; }
      const created = ensureDir(ctx.state.fs, abs, ctx.user);
      created.mtime = ctx.state.clock;
    }
    return errors.length ? fail(errors.join("\n")) : ok();
  },
};
