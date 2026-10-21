/**
 * 텍스트 필터 명령(grep·head·sort·wc·cat·tail)이 함께 쓰는 입력 읽기.
 * 파일 인자가 있으면 파일을, 없으면 파이프로 들어온 stdin을 읽는다.
 * stdin도 없으면 빈 입력으로 본다(이 시뮬레이터에는 키보드 입력을 기다리는 대화형 모드가 없다).
 */
import { canRead, isDir, lookup, walk } from "../state/fs";
import type { CommandContext } from "./types";

export interface Source {
  /** 출력에 붙일 이름. stdin이면 null */
  name: string | null;
  text: string;
}

export interface ReadResult {
  sources: Source[];
  errors: string[];
}

export function readSources(ctx: CommandContext, command: string, paths: string[], recursive = false): ReadResult {
  if (paths.length === 0) return { sources: [{ name: null, text: ctx.stdin ?? "" }], errors: [] };
  const sources: Source[] = [];
  const errors: string[] = [];
  for (const path of paths) {
    const { abs, node } = lookup(ctx.state, path);
    if (!node) {
      errors.push(`${command}: ${path}: No such file or directory`);
    } else if (isDir(node)) {
      if (!recursive) {
        errors.push(`${command}: ${path}: Is a directory`);
        continue;
      }
      // -r: 디렉터리 아래 파일을 이름 순서로 모두 읽는다. 출력에는 입력한 경로 기준 이름을 쓴다.
      const files = [...walk(node, abs)].filter(([, child]) => child.kind === "file").sort(([a], [b]) => a.localeCompare(b));
      for (const [childPath, child] of files) {
        const shown = path.replace(/\/$/, "") + childPath.slice(abs.length);
        if (child.kind !== "file") continue;
        if (!canRead(child, ctx.user)) errors.push(`${command}: ${shown}: Permission denied`);
        else sources.push({ name: shown, text: child.content });
      }
    } else if (!canRead(node, ctx.user)) {
      errors.push(`${command}: ${path}: Permission denied`);
    } else {
      sources.push({ name: path, text: node.content });
    }
  }
  return { sources, errors };
}

/** 끝의 줄바꿈 하나는 줄로 세지 않는다("a\nb\n" → ["a", "b"]). */
export function linesOf(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\n$/, "").split("\n");
}

/** "-20" 처럼 숫자만 쓴 옛 형식(head -20, tail -50)도 줄 수로 받는다. */
export function lineCount(tokens: string[], value: string | undefined, fallback: number): number | null {
  const legacy = tokens.find((t) => /^-\d+$/.test(t));
  const text = value ?? (legacy ? legacy.slice(1) : undefined);
  if (text === undefined) return fallback;
  return /^\d+$/.test(text) ? Number(text) : null;
}
