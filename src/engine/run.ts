/**
 * 명령어 실행기. 게임과 엔진을 잇는 유일한 입구다.
 *
 * 입력 한 줄을 받아 → 파이프로 나누기 → (단계마다) 파싱 → glob 확장 → 명령어 실행 → 리다이렉션 처리
 * 순서로 처리하고, 바뀐 새 상태를 돌려준다.
 */
import { DEFAULT_COMMANDS, getCommand } from "./commands";
import type { CommandResult } from "./commands/types";
import { parse, splitPipeline } from "./parser/parse";
import { syntaxError } from "./parser/syntax";
import { isDir, lookup, normalizePath, splitLast, writeFile, canWrite, findNode } from "./state/fs";
import type { SystemState } from "./state/types";

export interface RunResult extends CommandResult {
  /** 명령 실행 후의 새 상태 */
  state: SystemState;
}

export interface RunOptions {
  /** 이 시나리오에서 허용된 명령어. 없으면 기본 묶음을 쓴다. */
  available?: string[];
}

/**
 * 셸이 명령어에 넘기기 전에 하는 * 확장.
 * 예: "/var/log/*" → ["/var/log/syslog", "/var/log/nginx", ...]
 * 확장 결과가 없으면 실제 셸처럼 패턴 문자열을 그대로 넘긴다.
 */
function expandGlob(state: SystemState, token: string): string[] {
  if (!token.includes("*")) return [token];

  const abs = normalizePath(state.cwd, token);
  const { parent, name } = splitLast(abs);
  const dir = findNode(state.fs, parent);
  if (!dir || !isDir(dir)) return [token];

  // "*.log" 같은 패턴을 정규식으로 바꾼다. *만 지원한다.
  const pattern = new RegExp(`^${name.split("*").map(escapeRegex).join(".*")}$`);
  const matched = dir.children
    .filter((child) => pattern.test(child.name) && !child.name.startsWith("."))
    .map((child) => (parent === "/" ? `/${child.name}` : `${parent}/${child.name}`))
    .sort();

  return matched.length ? matched : [token];
}

function escapeRegex(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

export function runCommand(state: SystemState, input: string, options: RunOptions = {}): RunResult {
  // 상태는 항상 복사본에서 바꾼다. 원본이 그대로 남아야 React 리렌더와 테스트가 정확해진다.
  const next = structuredClone(state);
  const available = options.available ?? DEFAULT_COMMANDS;

  if (!input.trim()) return { stdout: "", stderr: "", exitCode: 0, state: next };
  const error = syntaxError(input);
  if (error) return { stdout: "", stderr: error, exitCode: 2, state: next };

  const stages = splitPipeline(input);
  if (!stages) {
    return { stdout: "", stderr: "bash: syntax error near unexpected token `|'", exitCode: 2, state: next };
  }

  // 파이프: 앞 명령의 stdout이 다음 명령의 stdin이 된다. 각 단계의 stderr는 실제 터미널처럼
  // 모두 화면에 남고, 종료 코드는 bash 기본값(pipefail 꺼짐)처럼 마지막 명령의 것이다.
  let stdin: string | undefined;
  const errors: string[] = [];
  let last: RunResult = { stdout: "", stderr: "", exitCode: 0, state: next };
  for (const stage of stages) {
    last = runStage(next, stage, available, stdin);
    if (last.stderr) errors.push(last.stderr);
    stdin = last.stdout;
  }
  return { ...last, stderr: errors.join("\n") };
}

/** 파이프 한 단계(명령 하나)를 실행한다. state는 이미 복사본이라 그대로 바꾼다. */
function runStage(next: SystemState, input: string, available: string[], stdin?: string): RunResult {
  const parsed = parse(input);
  const user = parsed.sudo ? "root" : next.user;

  // 명령어 없이 리다이렉션만 쓴 경우: "> /var/log/app.log" = 파일 비우기
  if (!parsed.name) {
    if (parsed.redirect) return applyRedirect(next, "", parsed.redirect, user);
    return { stdout: "", stderr: "", exitCode: 0, state: next };
  }

  // 존재하지만 이 시나리오에서 막아둔 명령어도, 플레이어 입장에선 없는 것과 같다
  if (!available.includes(parsed.name)) {
    return { stdout: "", stderr: `${parsed.name}: command not found`, exitCode: 127, state: next };
  }

  const command = getCommand(parsed.name)!;
  const tokens = parsed.tokens.flatMap((t) => (t.startsWith("-") ? [t] : expandGlob(next, t)));

  const result = command.run({ state: next, tokens, sudo: parsed.sudo, user, available, stdin });

  if (parsed.redirect) return applyRedirect(next, result.stdout, parsed.redirect, user, result);
  return { ...result, state: next };
}

/** stdout을 화면 대신 파일로 보낸다. ">"는 덮어쓰기, ">>"는 이어쓰기. */
function applyRedirect(
  state: SystemState,
  stdout: string,
  redirect: { path: string; append: boolean },
  user: string,
  base: CommandResult = { stdout: "", stderr: "", exitCode: 0 },
): RunResult {
  if (!redirect.path) {
    return { ...base, stdout: "", stderr: "bash: syntax error near unexpected token `newline'", exitCode: 2, state };
  }

  const { abs, node } = lookup(state, redirect.path);
  const parentNode = lookup(state, splitLast(abs).parent).node;

  if (node && !canWrite(node, user)) {
    return { ...base, stdout: "", stderr: `bash: ${redirect.path}: Permission denied`, exitCode: 1, state };
  }
  if (!node && (!parentNode || !canWrite(parentNode, user))) {
    return { ...base, stdout: "", stderr: `bash: ${redirect.path}: Permission denied`, exitCode: 1, state };
  }
  if (node && isDir(node)) {
    return { ...base, stdout: "", stderr: `bash: ${redirect.path}: Is a directory`, exitCode: 1, state };
  }

  const previous = redirect.append && node && node.kind === "file" ? node.content : "";
  const content = previous + (stdout ? `${stdout}\n` : "");
  writeFile(state.fs, abs, {
    content,
    owner: node?.owner ?? user,
    group: node?.group ?? user,
    mode: node?.mode ?? 0o644,
    mtime: state.clock,
    // 리다이렉션은 파일을 내용 길이만큼으로 다시 쓴다.
    // ">" 로 거대한 로그 파일을 비우는 실무 기법이 여기서 재현된다.
    sizeKB: redirect.append && node?.kind === "file" ? node.sizeKB + Math.ceil(stdout.length / 1024) : Math.ceil(content.length / 1024),
  });

  return { ...base, stdout: "", state };
}
