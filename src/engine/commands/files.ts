/** 파일을 다루는 명령어들: ls, cat, cd, pwd, tail, rm */
import { flagValue, hasFlag, positionals } from "../parser/parse";
import { canRead, canWrite, formatMode, isDir, lookup, removeNode, splitLast } from "../state/fs";
import { formatLogTime, humanKB, table } from "../state/format";
import type { FsNode } from "../state/types";
import { lineCount, readSources } from "./input";
import { fail, ok, type Command, type CommandContext } from "./types";

/** ls -l 한 줄을 만든다. 실제 ls와 열 구성을 맞췄다. */
function longLine(node: FsNode, human: boolean): string[] {
  const size = node.kind === "file" ? node.sizeKB * 1024 : 4096;
  return [
    formatMode(node),
    node.kind === "dir" ? "2" : "1",
    node.owner,
    node.group,
    human ? humanKB(size / 1024) : String(size),
    formatLogTime(node.mtime),
    node.name,
  ];
}

export const ls: Command = {
  name: "ls",
  summary: "디렉터리 내용을 본다 (-l 자세히, -h 읽기 쉬운 크기, -a 숨김 파일 포함)",
  usage: "ls [-lha] [경로...]",
  run({ state, tokens, user }: CommandContext) {
    const long = hasFlag(tokens, "l");
    const human = hasFlag(tokens, "h");
    const all = hasFlag(tokens, "a");
    const paths = positionals(tokens);
    if (paths.length === 0) paths.push(".");

    const blocks: string[] = [];
    const errors: string[] = [];

    for (const path of paths) {
      const { abs, node } = lookup(state, path);
      if (!node) {
        errors.push(`ls: cannot access '${path}': No such file or directory`);
        continue;
      }
      if (!canRead(node, user)) {
        errors.push(`ls: cannot open directory '${path}': Permission denied`);
        continue;
      }

      // 파일을 가리키면 그 파일 한 줄만 보여준다
      const entries = isDir(node) ? [...node.children] : [node];
      const visible = all ? entries : entries.filter((e) => !e.name.startsWith("."));
      visible.sort((a, b) => a.name.localeCompare(b.name));

      let body: string;
      if (long) {
        const rows = visible.map((e) => longLine(e, human));
        // total 줄은 실제 ls처럼 블록 수(1블록=1KB 가정)
        const totalKB = visible.reduce((s, e) => s + (e.kind === "file" ? e.sizeKB : 4), 0);
        body = rows.length ? `total ${totalKB}\n${table(rows, ["left", "right", "left", "left", "right", "left", "left"])}` : "total 0";
      } else {
        body = visible.map((e) => e.name).join("  ");
      }
      blocks.push(paths.length > 1 && isDir(node) ? `${abs}:\n${body}` : body);
    }

    const stdout = blocks.filter(Boolean).join("\n\n");
    if (errors.length) return { stdout, stderr: errors.join("\n"), exitCode: 2 };
    return ok(stdout);
  },
};

export const cat: Command = {
  name: "cat",
  summary: "파일 내용을 출력한다",
  usage: "cat [파일...]",
  run(ctx: CommandContext) {
    // 파일이 없으면 파이프로 들어온 내용을 그대로 낸다(실제 cat과 같다).
    const { sources, errors } = readSources(ctx, "cat", positionals(ctx.tokens));
    const stdout = sources.map((source) => source.text).join("").replace(/\n$/, "");
    if (errors.length) return { stdout, stderr: errors.join("\n"), exitCode: 1 };
    return ok(stdout);
  },
};

export const pwd: Command = {
  name: "pwd",
  summary: "현재 디렉터리를 출력한다",
  usage: "pwd",
  run: ({ state }) => ok(state.cwd),
};

export const cd: Command = {
  name: "cd",
  summary: "디렉터리를 이동한다",
  usage: "cd [경로]",
  run({ state, tokens, user }: CommandContext) {
    const target = positionals(tokens)[0] ?? "/home/ubuntu";
    const { abs, node } = lookup(state, target);
    if (!node) return fail(`cd: ${target}: No such file or directory`);
    if (!isDir(node)) return fail(`cd: ${target}: Not a directory`);
    if (!canRead(node, user)) return fail(`cd: ${target}: Permission denied`);
    state.cwd = abs;
    return ok();
  },
};

export const tail: Command = {
  name: "tail",
  summary: "파일의 마지막 줄을 본다 (-n 줄수, 기본 10)",
  usage: "tail [-n 줄수] [파일...]",
  run(ctx: CommandContext) {
    const { state, tokens, user } = ctx;
    const lines = lineCount(tokens, flagValue(tokens, "n", "lines"), 10);
    if (lines === null) return fail(`tail: invalid number of lines: '${flagValue(tokens, "n", "lines")}'`);
    const paths = positionals(tokens, ["n", "lines"]);
    const last = (text: string) => text.split("\n").filter((l) => l !== "").slice(-lines).join("\n");
    // 파일이 없으면 파이프로 들어온 내용의 끝을 본다(journalctl ... | tail).
    if (paths.length === 0) return ok(last(ctx.stdin ?? ""));

    const out: string[] = [];
    for (const path of paths) {
      const { node } = lookup(state, path);
      if (!node) return fail(`tail: cannot open '${path}' for reading: No such file or directory`);
      if (isDir(node)) return fail(`tail: error reading '${path}': Is a directory`);
      if (!canRead(node, user)) return fail(`tail: cannot open '${path}' for reading: Permission denied`);
      const body = last(node.content);
      out.push(paths.length > 1 ? `==> ${path} <==\n${body}` : body);
    }
    return ok(out.join("\n\n"));
  },
};

export const rm: Command = {
  name: "rm",
  summary: "파일을 삭제한다 (-r 디렉터리째, -f 강제)",
  usage: "rm [-rf] <파일...>",
  run({ state, tokens, user }: CommandContext) {
    const recursive = hasFlag(tokens, "r") || hasFlag(tokens, "R");
    const force = hasFlag(tokens, "f");
    const paths = positionals(tokens);
    if (paths.length === 0) return fail("rm: missing operand");

    const errors: string[] = [];
    for (const path of paths) {
      const { abs, node } = lookup(state, path);
      if (!node) {
        if (!force) errors.push(`rm: cannot remove '${path}': No such file or directory`);
        continue;
      }
      if (isDir(node) && !recursive) {
        errors.push(`rm: cannot remove '${path}': Is a directory`);
        continue;
      }
      // 실제 리눅스는 "파일이 든 디렉터리"에 쓰기 권한이 있어야 지울 수 있다.
      const { parent } = splitLast(abs);
      const parentNode = lookup(state, parent).node;
      if (!parentNode || !canWrite(parentNode, user)) {
        errors.push(`rm: cannot remove '${path}': Permission denied`);
        continue;
      }
      removeNode(state.fs, abs);
    }
    if (errors.length) return { stdout: "", stderr: errors.join("\n"), exitCode: 1 };
    return ok();
  },
};
