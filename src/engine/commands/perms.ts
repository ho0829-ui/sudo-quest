/** 권한을 바꾸는 명령어: chmod, chown */
import { hasFlag, positionals } from "../parser/parse";
import { isDir, lookup, walk } from "../state/fs";
import type { FsNode } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

/** "644" 또는 "o+r", "a-w" 같은 표기를 해석해 새 mode를 만든다. */
function applyMode(current: number, spec: string): number | null {
  if (/^[0-7]{3,4}$/.test(spec)) return parseInt(spec, 8);

  // 기호 표기: [ugoa][+-=][rwx]
  const match = /^([ugoa]*)([+\-=])([rwx]+)$/.exec(spec);
  if (!match) return null;

  const [, whoRaw, op, permsRaw] = match;
  const who = whoRaw === "" || whoRaw === "a" ? "ugo" : whoRaw;
  const bits = (permsRaw.includes("r") ? 4 : 0) + (permsRaw.includes("w") ? 2 : 0) + (permsRaw.includes("x") ? 1 : 0);

  let mode = current;
  for (const target of who) {
    const shift = target === "u" ? 6 : target === "g" ? 3 : 0;
    if (op === "+") mode |= bits << shift;
    else if (op === "-") mode &= ~(bits << shift);
    else mode = (mode & ~(0o7 << shift)) | (bits << shift);
  }
  return mode;
}

/** -R 이면 하위 항목까지, 아니면 자기 자신만 대상으로 삼는다. */
function targets(node: FsNode, path: string, recursive: boolean): FsNode[] {
  if (!recursive || !isDir(node)) return [node];
  return [...walk(node, path)].map(([, child]) => child);
}

export const chmod: Command = {
  name: "chmod",
  summary: "파일 권한을 바꾼다 (-R 하위까지)",
  usage: "chmod [-R] <권한> <경로...>",
  run({ state, tokens, user }: CommandContext) {
    const recursive = hasFlag(tokens, "R") || hasFlag(tokens, "r", "recursive");
    const args = positionals(tokens);
    const [spec, ...paths] = args;
    if (!spec || paths.length === 0) return fail("chmod: missing operand", 1);

    for (const path of paths) {
      const { abs, node } = lookup(state, path);
      if (!node) return fail(`chmod: cannot access '${path}': No such file or directory`, 1);
      // 권한을 바꾸려면 소유자이거나 root여야 한다
      if (user !== "root" && node.owner !== user) {
        return fail(`chmod: changing permissions of '${path}': Operation not permitted`, 1);
      }
      for (const target of targets(node, abs, recursive)) {
        const mode = applyMode(target.mode, spec);
        if (mode === null) return fail(`chmod: invalid mode: '${spec}'`, 1);
        target.mode = mode;
      }
    }
    return ok();
  },
};

export const chown: Command = {
  name: "chown",
  summary: "파일 소유자를 바꾼다 (-R 하위까지)",
  usage: "chown [-R] <소유자[:그룹]> <경로...>",
  run({ state, tokens, user }: CommandContext) {
    const recursive = hasFlag(tokens, "R") || hasFlag(tokens, "r", "recursive");
    const args = positionals(tokens);
    const [spec, ...paths] = args;
    if (!spec || paths.length === 0) return fail("chown: missing operand", 1);

    // 소유자 변경은 root만 할 수 있다 (실제 리눅스와 같다)
    if (user !== "root") {
      return fail(`chown: changing ownership of '${paths[0]}': Operation not permitted`, 1);
    }

    const [owner, group] = spec.split(":");
    for (const path of paths) {
      const { abs, node } = lookup(state, path);
      if (!node) return fail(`chown: cannot access '${path}': No such file or directory`, 1);
      for (const target of targets(node, abs, recursive)) {
        if (owner) target.owner = owner;
        if (group) target.group = group;
      }
    }
    return ok();
  },
};
