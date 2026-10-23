/**
 * 열린 파일 수(파일 디스크립터) 계산. 연결 하나가 fd 하나를 쓰므로,
 * 필요한 연결이 프로세스의 soft 한도를 넘으면 새 연결을 받지 못한다(accept가 EMFILE로 실패).
 * fd 목록을 저장하지 않고 서비스의 연결 수와 한도에서 계산한다. /proc·lsof·curl이 모두 이 값을 본다.
 */
import type { Process, Service, SystemState } from "./types";

/** systemd 서비스의 기본 한도(DefaultLimitNOFILE=1024:524288) */
export const SYSTEMD_NOFILE = { soft: 1024, hard: 524288 };

export interface FdUsage {
  soft: number;
  hard: number;
  /** 필요한 fd(기본 파일 + 리스닝 소켓 + 연결) */
  wanted: number;
  /** 실제로 열려 있는 fd. 한도를 넘을 수 없다. */
  open: number;
  base: number;
  listen: number;
  /** 열어 둔 연결 수 */
  connections: number;
  /** 한도에 막혀 새 연결을 받지 못하는 중 */
  saturated: boolean;
}

export function serviceOf(state: SystemState, process: Process): Service | undefined {
  return process.service ? state.services.find(s => s.name === process.service) : undefined;
}

export function fdUsage(state: SystemState, process: Process): FdUsage {
  const { soft, hard } = process.nofile ?? SYSTEMD_NOFILE;
  const service = serviceOf(state, process);
  const base = service?.baseFds ?? 8;
  const listen = process.listenPorts?.length ?? 0;
  const demand = service?.connections ?? 0;
  const wanted = base + listen + demand;
  const open = Math.min(wanted, soft);
  return { soft, hard, wanted, open, base, listen, connections: Math.max(0, open - base - listen), saturated: demand > 0 && wanted > soft };
}

/** /proc/sys/fs/file-nr의 첫 값: 시스템 전체에 열린 파일 수(커널·다른 프로세스 몫 포함). */
export function systemOpenFiles(state: SystemState): number {
  return 1184 + state.processes.reduce((sum, p) => sum + fdUsage(state, p).open, 0);
}
