/**
 * 상태에서 "계산되는" 값들.
 *
 * df, du, free, ss 의 출력은 저장된 값이 아니라 전부 여기서 만들어진다.
 * 그래서 플레이어가 파일을 지우거나 프로세스를 죽이면 출력이 저절로 바뀐다.
 * (CLAUDE.md 4-2 참고)
 */
import { walk } from "./fs";
import type { Disk, SystemState } from "./types";

/** 이 경로가 속한 마운트를 찾는다. 가장 깊게 일치하는 마운트가 이긴다. */
export function mountFor(state: SystemState, absPath: string): Disk {
  let best = state.disks[0];
  for (const disk of state.disks) {
    const isUnder = absPath === disk.mount || absPath.startsWith(disk.mount === "/" ? "/" : `${disk.mount}/`);
    if (isUnder && disk.mount.length >= best.mount.length) best = disk;
  }
  return best;
}

export interface DiskUsage {
  disk: Disk;
  usedKB: number;
  availKB: number;
  usePercent: number;
}

/** df 한 줄에 해당하는 값. 기본 사용량 + 그 마운트에 속한 모든 파일 크기의 합. */
export function diskUsage(state: SystemState, mount: string): DiskUsage {
  const disk = state.disks.find((d) => d.mount === mount);
  if (!disk) throw new Error(`마운트를 찾을 수 없습니다: ${mount}`);

  let fileKB = 0;
  for (const [path, node] of walk(state.fs, "/")) {
    if (node.kind !== "file") continue;
    if (mountFor(state, path).mount === mount) fileKB += node.sizeKB;
  }

  const usedKB = disk.reservedKB + fileKB;
  const availKB = Math.max(0, disk.totalKB - usedKB);
  return {
    disk,
    usedKB,
    availKB,
    usePercent: Math.min(100, Math.round((usedKB / disk.totalKB) * 100)),
  };
}

export function allDiskUsage(state: SystemState): DiskUsage[] {
  return state.disks.map((d) => diskUsage(state, d.mount));
}

/** du: 해당 경로 아래 파일 크기의 합 (디렉터리 자체 크기는 세지 않는다 — 단순화) */
export function duKB(state: SystemState, absPath: string): number {
  const root = [...walk(state.fs, "/")].find(([p]) => p === absPath);
  if (!root) return 0;
  let total = 0;
  for (const [, node] of walk(root[1], absPath)) {
    if (node.kind === "file") total += node.sizeKB;
  }
  return total;
}

export interface MemoryUsage {
  totalKB: number;
  usedKB: number;
  freeKB: number;
}

/** free: 기본 사용량 + 모든 프로세스의 메모리 합 */
export function memoryUsage(state: SystemState): MemoryUsage {
  const processKB = state.processes.reduce((sum, p) => sum + p.memKB, 0);
  const usedKB = state.memory.reservedKB + processKB;
  return {
    totalKB: state.memory.totalKB,
    usedKB,
    freeKB: Math.max(0, state.memory.totalKB - usedKB),
  };
}

export interface Socket {
  addr: string;
  port: number;
  pid: number;
  program: string;
}

/** ss -tlnp: 프로세스가 들고 있는 리스닝 소켓을 모은다. */
export function listeningSockets(state: SystemState): Socket[] {
  const sockets: Socket[] = [];
  for (const proc of state.processes) {
    for (const listen of proc.listenPorts ?? []) {
      sockets.push({
        addr: listen.addr,
        port: listen.port,
        pid: proc.pid,
        program: proc.command.split(" ")[0].split("/").pop() ?? proc.command,
      });
    }
  }
  return sockets.sort((a, b) => a.port - b.port);
}

/** 이 포트를 이미 누가 쓰고 있는가? 서비스 시작 실패 판정에 쓴다. */
export function portOwner(state: SystemState, addr: string, port: number): Socket | undefined {
  return listeningSockets(state).find(
    (s) => s.port === port && (s.addr === addr || s.addr === "0.0.0.0" || addr === "0.0.0.0"),
  );
}

export function nextPid(state: SystemState): number {
  return Math.max(1000, ...state.processes.map((p) => p.pid)) + 1;
}
