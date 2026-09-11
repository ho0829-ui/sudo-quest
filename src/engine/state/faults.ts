/**
 * 장애 주입(fault) 헬퍼.
 *
 * 시나리오는 "정상 프리셋 + 장애 몇 개"로 표현된다.
 * 여기 있는 헬퍼를 조합하면 엔진 코드를 고치지 않고 새 시나리오를 만들 수 있다.
 */
import { writeFile } from "./fs";
import { addLog } from "./log";
import { findService, startService, stopService } from "./services";
import type { LogPriority, SystemState } from "./types";

/** 장애는 상태를 직접 바꾸는 함수다. (시나리오 시작 시 한 번만 실행된다) */
export type Fault = (state: SystemState) => void;

/** 파일을 만들거나 덮어쓴다. 로그 폭증 같은 상황을 만들 때 쓴다. */
export function putFile(
  path: string,
  options: { sizeKB?: number; content?: string; owner?: string; group?: string; mode?: number; mtimeOffsetMs?: number },
): Fault {
  return (state) => {
    writeFile(state.fs, path, {
      ...options,
      mtime: state.clock + (options.mtimeOffsetMs ?? 0),
    });
  };
}

/** 서비스를 특정 상태로 만든다. 프로세스도 같이 정리한다. */
export function crashService(
  name: string,
  reason: string,
  options: { agoMs?: number } = {},
): Fault {
  return (state) => {
    const service = findService(state, name);
    if (!service) throw new Error(`서비스를 찾을 수 없습니다: ${name}`);
    state.processes = state.processes.filter((p) => p.service !== service.name);
    service.state = "failed";
    service.mainPid = undefined;
    service.lastExitReason = reason;
    // 언제 죽었는지가 중요하다. systemctl status의 "n분 전" 표시가 여기서 나온다.
    service.since = state.clock - (options.agoMs ?? 0);
  };
}

/** 과거 시점의 로그를 남긴다. (offsetMs는 음수 = 과거) */
export function logLine(
  tag: string,
  message: string,
  options: { unit?: string; priority?: LogPriority; offsetMs?: number; pid?: number } = {},
): Fault {
  return (state) => {
    const saved = state.clock;
    state.clock = saved + (options.offsetMs ?? 0);
    addLog(state, {
      tag,
      message,
      unit: options.unit,
      priority: options.priority,
      pid: options.pid,
    });
    state.clock = saved;
  };
}

/**
 * 과거 시점에 서비스를 재시작한 것으로 만든다.
 *
 * 설정 파일을 바꾸는 fault와 짝을 이룬다.
 * 설정만 고쳐 두면 "파일은 바뀌었는데 돌고 있는 프로세스는 예전 그대로"인
 * 모순된 상태가 된다. 실제로 재시작을 거쳐야 상태가 앞뒤가 맞는다.
 */
export function restartedAt(name: string, agoMs: number): Fault {
  return (state) => {
    const saved = state.clock;
    state.clock = saved - agoMs;
    stopService(state, name);
    startService(state, name);
    state.clock = saved;
  };
}

/** 시계를 앞뒤로 움직인다. (인증서 만료 같은 시나리오용) */
export function setClock(epochMs: number): Fault {
  return (state) => {
    state.clock = epochMs;
  };
}
