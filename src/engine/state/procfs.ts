/**
 * /proc 가상 파일. 저장하지 않고 읽을 때마다 프로세스 상태에서 만든다(limits, fd, status, sys/fs/file-nr).
 * cat·grep·wc·ls가 일반 파일처럼 읽는다. 쓰기·삭제는 지원하지 않는다(실제 /proc도 대부분 읽기 전용이다).
 */
import { fdUsage, systemOpenFiles } from "./limits";
import { lookup, normalizePath } from "./fs";
import type { DirNode, FileNode, FsNode, Process, SystemState } from "./types";

const file = (name: string, content: string, owner = "root", mode = 0o444, mtime = 0): FileNode =>
  ({ kind: "file", name, owner, group: owner, mode, mtime, sizeKB: 0, content });
const dir = (name: string, children: FsNode[], owner = "root", mode = 0o555, mtime = 0): DirNode =>
  ({ kind: "dir", name, owner, group: owner, mode, mtime, children });

/** /proc/PID/limits 표. Max open files 줄이 이 실습의 핵심 단서다. */
function limitsText(state: SystemState, process: Process): string {
  const { soft, hard } = fdUsage(state, process);
  const rows: [string, string, string, string][] = [
    ["Limit", "Soft Limit", "Hard Limit", "Units"], ["Max cpu time", "unlimited", "unlimited", "seconds"],
    ["Max file size", "unlimited", "unlimited", "bytes"], ["Max data size", "unlimited", "unlimited", "bytes"],
    ["Max stack size", "8388608", "unlimited", "bytes"], ["Max core file size", "0", "unlimited", "bytes"],
    ["Max resident set", "unlimited", "unlimited", "bytes"], ["Max processes", "7645", "7645", "processes"],
    ["Max open files", String(soft), String(hard), "files"], ["Max locked memory", "8388608", "8388608", "bytes"],
    ["Max address space", "unlimited", "unlimited", "bytes"], ["Max file locks", "unlimited", "unlimited", "locks"],
    ["Max pending signals", "7645", "7645", "signals"], ["Max msgqueue size", "819200", "819200", "bytes"],
    ["Max nice priority", "0", "0", ""], ["Max realtime priority", "0", "0", ""], ["Max realtime timeout", "unlimited", "unlimited", "us"],
  ];
  return rows.map(([a, b, c, d]) => `${a.padEnd(26)}${b.padEnd(21)}${c.padEnd(21)}${d}`.trimEnd()).join("\n");
}

const BASE_TARGETS = ["/dev/null", "socket:[STD]", "socket:[STD]", "anon_inode:[eventpoll]", "pipe:[P]", "pipe:[P]", "anon_inode:[eventfd]", "/dev/urandom"];

/** fd 번호와 링크 대상. 0~2는 표준 입출력, 그다음 기본 파일, 리스닝 소켓, 연결 소켓 순서다. lsof도 이 목록을 쓴다. */
export function fdTargets(state: SystemState, process: Process): { fd: number; target: string; kind: "base" | "listen" | "conn" }[] {
  const usage = fdUsage(state, process);
  const inode = 30_000 + ((process.pid * 37) % 9000);
  const list: { fd: number; target: string; kind: "base" | "listen" | "conn" }[] = [];
  for (let i = 0; i < usage.base; i++) {
    const template = i < BASE_TARGETS.length ? BASE_TARGETS[i] : `/var/log/${process.service ?? "app"}/app.log`;
    list.push({ fd: i, kind: "base", target: template.replace("STD", String(inode)).replace("P", String(inode + 1)) });
  }
  for (let i = 0; i < usage.listen; i++) list.push({ fd: list.length, kind: "listen", target: `socket:[${inode + 10 + i}]` });
  for (let i = 0; i < usage.connections; i++) list.push({ fd: list.length, kind: "conn", target: `socket:[${inode + 100 + i}]` });
  return list;
}

function statusText(state: SystemState, process: Process): string {
  const name = process.command.split(" ")[0].split("/").pop() ?? process.command;
  const open = fdUsage(state, process).open;
  return [`Name:\t${name}`, "State:\tS (sleeping)", `Pid:\t${process.pid}`, "PPid:\t1", `Uid:\t${process.user === "root" ? 0 : 1000}`,
    `FDSize:\t${2 ** Math.ceil(Math.log2(Math.max(64, open)))}`, `VmRSS:\t${process.memKB} kB`, "Threads:\t11"].join("\n");
}

function procNode(state: SystemState, abs: string): FsNode | null {
  const parts = abs.split("/").filter(Boolean).slice(1);
  if (parts[0] === "sys") {
    const fs = () => dir("fs", [file("file-max", "9223372036854775807"), file("file-nr", `${systemOpenFiles(state)}\t0\t9223372036854775807`), file("nr_open", "1048576")]);
    if (parts.length === 1) return dir("sys", [fs()]);
    if (parts[1] !== "fs") return null;
    const node = fs();
    return parts.length === 2 ? node : node.children.find(c => c.name === parts[2] && parts.length === 3) ?? null;
  }
  if (!parts.length) {
    return dir("proc", [...state.processes.map(p => dir(String(p.pid), [], p.user)), dir("sys", [])]);
  }
  const process = state.processes.find(p => String(p.pid) === parts[0]);
  if (!process) return null;
  // fd 목록은 그 프로세스의 사용자와 root만 볼 수 있다(dr-x------).
  const fds = () => dir("fd", fdTargets(state, process).map(({ fd, target }) =>
    ({ ...file(String(fd), "", process.user, 0o700, state.clock), sizeKB: 64 / 1024, link: target })), process.user, 0o500, state.clock);
  const children: FsNode[] = [fds(), file("limits", limitsText(state, process), process.user), file("status", statusText(state, process), process.user)];
  if (parts.length === 1) return dir(String(process.pid), children, process.user);
  const child = children.find(c => c.name === parts[1]);
  if (!child || parts.length === 2) return child ?? null;
  return child.kind === "dir" && parts.length === 3 ? child.children.find(c => c.name === parts[2]) ?? null : null;
}

/** 읽기 명령용 경로 찾기: /proc 아래는 계산한 노드, 그 밖은 실제 가상 파일시스템. */
export function resolveForRead(state: SystemState, path: string): { abs: string; node: FsNode | null } {
  const abs = normalizePath(state.cwd, path);
  if (abs === "/proc" || abs.startsWith("/proc/")) return { abs, node: procNode(state, abs) };
  return lookup(state, path);
}
