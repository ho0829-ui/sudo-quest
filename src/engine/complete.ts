/**
 * Tab 자동완성.
 *
 * 첫 단어는 명령어 이름을, 그 뒤는 파일 경로를 완성한다.
 * 실제 셸처럼 "후보가 하나면 끝까지, 여러 개면 공통 부분까지"만 채운다.
 */
import { DEFAULT_COMMANDS } from "./commands";
import { findNode, isDir, normalizePath } from "./state/fs";
import type { SystemState } from "./state/types";

export interface Completion {
  /** 자동완성이 적용된 전체 입력 문자열 */
  input: string;
  /** 후보가 여럿이면 화면에 보여줄 목록 */
  candidates: string[];
}

export function complete(
  state: SystemState,
  input: string,
  available: string[] = DEFAULT_COMMANDS,
): Completion {
  // 마지막 단어를 완성 대상으로 삼는다. 입력이 공백으로 끝나면 새 단어를 시작하는 것이다.
  const endsWithSpace = /\s$/.test(input);
  const words = input.split(/\s+/).filter(Boolean);
  const target = endsWithSpace ? "" : (words[words.length - 1] ?? "");
  const prefixWords = endsWithSpace ? words : words.slice(0, -1);

  const isFirstWord = prefixWords.length === 0 || (prefixWords.length === 1 && prefixWords[0] === "sudo");

  const matches = isFirstWord
    ? available.filter((name) => name.startsWith(target)).sort()
    : completePath(state, target);

  if (matches.length === 0) return { input, candidates: [] };

  const shared = commonPrefix(matches);
  // 후보가 하나뿐이면 뒤에 공백을 붙여 다음 인자를 바로 칠 수 있게 한다 (디렉터리는 제외)
  const suffix = matches.length === 1 && !shared.endsWith("/") ? " " : "";
  const completed = [...prefixWords, shared].join(" ") + suffix;

  return {
    input: completed,
    candidates: matches.length > 1 ? matches : [],
  };
}

/** 경로 후보를 찾는다. 디렉터리면 뒤에 "/"를 붙여 계속 파고들 수 있게 한다. */
function completePath(state: SystemState, target: string): string[] {
  // "/var/lo" → 디렉터리는 "/var", 찾을 이름은 "lo"
  const hasSlash = target.includes("/");
  const dirPart = hasSlash ? target.slice(0, target.lastIndexOf("/")) || "/" : ".";
  const namePart = hasSlash ? target.slice(target.lastIndexOf("/") + 1) : target;

  const dirNode = findNode(state.fs, normalizePath(state.cwd, dirPart));
  if (!dirNode || !isDir(dirNode)) return [];

  const prefix = hasSlash ? `${dirPart === "/" ? "" : dirPart}/` : "";
  return dirNode.children
    .filter((child) => child.name.startsWith(namePart) && !child.name.startsWith("."))
    .map((child) => `${prefix}${child.name}${child.kind === "dir" ? "/" : ""}`)
    .sort();
}

/** 후보들이 공유하는 가장 긴 앞부분 */
function commonPrefix(values: string[]): string {
  if (values.length === 1) return values[0];
  let prefix = values[0];
  for (const value of values.slice(1)) {
    while (!value.startsWith(prefix)) prefix = prefix.slice(0, -1);
  }
  return prefix;
}
