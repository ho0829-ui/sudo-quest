/**
 * 텍스트 편집 명령어: sed
 *
 * 이 게임에는 vi/nano 같은 화면 편집기를 넣을 수 없다.
 * 대신 실무에서 설정 파일을 고칠 때 실제로 자주 쓰는 `sed -i` 를 지원한다.
 * 지원 범위는 치환(s/찾을것/바꿀것/[g]) 하나뿐이다.
 */
import { hasFlag, positionals } from "../parser/parse";
import { canWrite, isDir, lookup, writeFile } from "../state/fs";
import { fail, ok, type Command, type CommandContext } from "./types";

interface Substitution {
  pattern: string;
  replacement: string;
  global: boolean;
}

/** "s/old/new/g" 를 뜯는다. 구분자는 / 만 지원한다. */
function parseScript(script: string): Substitution | null {
  if (!script.startsWith("s")) return null;
  const delimiter = script[1];
  if (delimiter !== "/") return null;

  const parts: string[] = [];
  let current = "";
  for (let i = 2; i < script.length; i++) {
    const ch = script[i];
    if (ch === "\\" && script[i + 1] === delimiter) {
      current += delimiter;
      i++;
      continue;
    }
    if (ch === delimiter) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);

  if (parts.length < 2) return null;
  return { pattern: parts[0], replacement: parts[1], global: (parts[2] ?? "").includes("g") };
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const sed: Command = {
  name: "sed",
  summary: "파일 내용을 치환한다 (-i 파일에 바로 반영)",
  usage: "sed [-i] 's/찾을것/바꿀것/[g]' <파일>",
  run({ state, tokens, user, stdin }: CommandContext) {
    const inPlace = hasFlag(tokens, "i", "in-place");
    const args = positionals(tokens);
    const [script, path] = args;

    if (!script) {
      return fail("Usage: sed [OPTION]... {script-only-if-no-other-script} [input-file]...", 1);
    }

    const substitution = parseScript(script);
    if (!substitution) {
      return fail(`sed: -e expression #1, char 1: unknown command: '${script[0]}'`, 1);
    }

    // 파일 없이 쓰면 파이프로 들어온 내용을 바꿔 출력한다(-i는 바꿀 파일이 있어야 한다).
    if (!path) {
      if (inPlace) return fail("sed: no input files", 1);
      const piped = (stdin ?? "").replace(new RegExp(escapeRegex(substitution.pattern), substitution.global ? "g" : ""), substitution.replacement);
      return ok(piped);
    }

    const { abs, node } = lookup(state, path);
    if (!node) return fail(`sed: can't read ${path}: No such file or directory`, 2);
    if (isDir(node)) return fail(`sed: read error on ${path}: Is a directory`, 4);

    // sed는 정규식을 쓰지만, 설정 파일을 고치는 데는 문자열 그대로 찾는 쪽이 덜 헷갈린다.
    // 특수문자를 escape 해서 "보이는 대로" 치환되게 한다.
    const regex = new RegExp(escapeRegex(substitution.pattern), substitution.global ? "g" : "");
    const result = node.content.replace(regex, substitution.replacement);

    if (!inPlace) return ok(result.replace(/\n$/, ""));

    if (!canWrite(node, user)) return fail(`sed: couldn't open temporary file: Permission denied`, 4);
    writeFile(state.fs, abs, {
      content: result,
      owner: node.owner,
      group: node.group,
      mode: node.mode,
      mtime: state.clock,
    });
    return ok();
  },
};
