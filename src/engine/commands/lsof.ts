/**
 * lsof: 프로세스가 연 파일 목록. /proc/PID/fd와 같은 계산(procfs.fdTargets)에서 만든다.
 * 다른 사용자의 프로세스는 root만 자세히 볼 수 있다(일반 사용자는 Permission denied 줄만 보인다).
 * 지원: -p PID[,PID], -i [:PORT], -n·-P(이름·포트 변환 안 함 — 가상 환경은 원래 숫자로 보여 준다).
 */
import { fdUsage } from "../state/limits";
import { fdTargets } from "../state/procfs";
import type { Process, SystemState } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

type Row = [string, string, string, string, string, string, string, string, string];

function programOf(process: Process) {
  return (process.command.split(" ")[0].split("/").pop() ?? process.command).slice(0, 9);
}

function hostIp(state: SystemState) {
  return state.network.interfaces.find(i => i.name !== "lo")?.addr ?? "127.0.0.1";
}

/**
 * 한 프로세스의 줄들. net이 있으면(-i) 네트워크 소켓만, port까지 있으면 그 포트만 보여 준다.
 * 연결 상대 주소는 로드 밸런서 두 대(10.0.0.12·13)에서 오는 것으로 만든다.
 */
function rowsOf(state: SystemState, process: Process, user: string, net?: { port?: number }): Row[] {
  const head: [string, string, string] = [programOf(process), String(process.pid), process.user];
  if (user !== "root" && user !== process.user) {
    if (net) return [];
    return [["cwd", "unknown", "", "", "", `/proc/${process.pid}/cwd (readlink: Permission denied)`],
      ["rtd", "unknown", "", "", "", `/proc/${process.pid}/root (readlink: Permission denied)`],
      ["txt", "unknown", "", "", "", `/proc/${process.pid}/exe (readlink: Permission denied)`],
      ["NOFD", "", "", "", "", `/proc/${process.pid}/fd (opendir: Permission denied)`]].map(r => [...head, ...r] as Row);
  }
  const ports = process.listenPorts ?? [];
  const { base } = fdUsage(state, process);
  const rows: Row[] = net ? [] : [
    [...head, "cwd", "DIR", "259,1", "4096", "2", "/"],
    [...head, "rtd", "DIR", "259,1", "4096", "2", "/"],
    [...head, "txt", "REG", "259,1", "96319360", "1835", process.command.split(" ")[0]],
  ];
  for (const { fd, target, kind } of fdTargets(state, process)) {
    const inode = /\[(\d+)\]/.exec(target)?.[1] ?? "0";
    if (kind === "listen" || kind === "conn") {
      const listen = kind === "listen" ? ports[fd - base] : ports[0];
      if (!listen || (net?.port !== undefined && listen.port !== net.port)) continue;
      const index = fd - base - ports.length;
      const name = kind === "listen"
        ? `${listen.addr === "0.0.0.0" ? "*" : listen.addr}:${listen.port} (LISTEN)`
        : `${hostIp(state)}:${listen.port}->10.0.0.${12 + (index % 2)}:${32768 + index} (ESTABLISHED)`;
      rows.push([...head, `${fd}u`, "IPv4", inode, "0t0", "TCP", name]);
      continue;
    }
    if (net) continue;
    if (target === "/dev/null") rows.push([...head, `${fd}r`, "CHR", "1,3", "0t0", "5", target]);
    else if (target === "/dev/urandom") rows.push([...head, `${fd}r`, "CHR", "1,9", "0t0", "10", target]);
    else if (target.startsWith("socket:")) rows.push([...head, `${fd}u`, "unix", `0x${(process.pid * 4099).toString(16).padStart(16, "0")}`, "0t0", inode, "type=STREAM (CONNECTED)"]);
    else if (target.startsWith("pipe:")) rows.push([...head, `${fd}${fd % 2 ? "r" : "w"}`, "FIFO", "0,13", "0t0", inode, "pipe"]);
    else if (target.startsWith("anon_inode:")) rows.push([...head, `${fd}u`, "a_inode", "0,14", "0", "1068", target.slice(11)]);
    else rows.push([...head, `${fd}w`, "REG", "259,1", "1048576", "4211", target]);
  }
  return rows;
}

function table(rows: Row[]): string {
  const header: Row = ["COMMAND", "PID", "USER", "FD", "TYPE", "DEVICE", "SIZE/OFF", "NODE", "NAME"];
  const all = [header, ...rows];
  const widths = header.map((_, i) => Math.max(...all.map(r => r[i].length)));
  // 숫자 열(PID·DEVICE·SIZE/OFF·NODE)과 FD는 오른쪽 정렬이다(실제 lsof 모양).
  const right = new Set([1, 3, 5, 6, 7]);
  return all.map(r => r.map((cell, i) => (i === r.length - 1 ? cell : right.has(i) ? cell.padStart(widths[i]) : cell.padEnd(widths[i]))).join(" ").trimEnd()).join("\n");
}

export const lsof: Command = {
  name: "lsof",
  summary: "프로세스가 연 파일·소켓을 본다 (-p PID, -i :포트)",
  usage: "lsof [-nP] [-p PID] [-i [:포트]]",
  run({ state, tokens, user }: CommandContext) {
    let pids: string[] | undefined;
    let port: number | undefined;
    let network = false;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === "-n" || token === "-P" || token === "-nP" || token === "-Pn") continue;
      if (token === "-p" || token.startsWith("-p")) {
        const value = token === "-p" ? tokens[++i] : token.slice(2);
        if (!value || !/^\d+(,\d+)*$/.test(value)) return fail(`lsof: illegal process ID: ${value ?? ""}`);
        pids = value.split(",");
      } else if (token === "-i" || token.startsWith("-i")) {
        network = true;
        const value = token === "-i" ? (tokens[i + 1]?.startsWith(":") ? tokens[++i] : "") : token.slice(2);
        if (value && !/^:\d+$/.test(value)) return fail(`lsof: unacceptable port specification in: -i ${value}`);
        if (value) port = Number(value.slice(1));
      } else {
        return fail(`lsof: unsupported option: ${token}\nlsof 4.95.0\n usage: [-nP] [-p s] [-i [i]]`);
      }
    }
    const targets = state.processes.filter(p => !pids || pids.includes(String(p.pid)));
    const rows = targets.flatMap(p => rowsOf(state, p, user, network ? { port } : undefined));
    return rows.length ? ok(table(rows)) : { stdout: "", stderr: "", exitCode: 1 };
  },
};
