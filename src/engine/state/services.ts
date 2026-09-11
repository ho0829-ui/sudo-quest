/**
 * 서비스 시작/정지 규칙.
 *
 * 중요: "nginx가 시작에 실패한다"를 시나리오에 하드코딩하지 않는다.
 * 엔진이 공통 규칙을 검사해서 실패시킨다. 그래서 플레이어가 원인을 없애면
 * (예: 디스크를 비우면) 시나리오를 고치지 않아도 서비스가 정상적으로 뜬다.
 *
 * 현재 검사하는 규칙:
 *   1) 디스크 여유 공간 부족  → No space left on device
 *   2) 포트 점유             → Address already in use
 *   3) 설정 파일 문법 오류    → syntax error
 *
 * 시나리오는 원인만 심어두면 되고, "그래서 서비스가 뜨지 못한다"는 판단은 엔진이 한다.
 */
import { configValidators } from "./config/nginx";
import { diskUsage, nextPid, portOwner } from "./derived";
import { findNode } from "./fs";
import { addLog } from "./log";
import type { Service, SystemState } from "./types";

export interface StartOutcome {
  ok: boolean;
  /** 실패 사유. systemctl status와 journalctl에서 볼 수 있게 로그로도 남는다. */
  reason?: string;
}

export function findService(state: SystemState, name: string): Service | undefined {
  // 플레이어는 "nginx" 로도, "nginx.service" 로도 입력할 수 있다.
  const bare = name.replace(/\.service$/, "");
  return state.services.find((s) => s.name === bare);
}

/** 시작을 막는 이유를 찾는다. 없으면 null. */
function blockingReason(state: SystemState, service: Service): string | null {
  if (service.requiresFreeKB) {
    const { availKB } = diskUsage(state, "/");
    if (availKB < service.requiresFreeKB) return "No space left on device";
  }

  // 설정 파일 문법 검사. nginx -t 와 똑같은 함수를 쓰므로 결과가 어긋나지 않는다.
  if (service.configPath && service.configValidator) {
    const node = findNode(state.fs, service.configPath);
    if (!node || node.kind !== "file") {
      return `open() "${service.configPath}" failed (2: No such file or directory)`;
    }
    const check = configValidators[service.configValidator](node.content);
    if (!check.ok && check.error) {
      return `[emerg] ${check.error.message} in ${service.configPath}:${check.error.line}`;
    }
  }

  for (const listen of service.listenPorts ?? []) {
    const owner = portOwner(state, listen.addr, listen.port);
    // 자기 자신이 이미 쓰고 있는 건 충돌이 아니다
    if (owner && owner.pid !== service.mainPid) {
      return `bind() to ${listen.addr}:${listen.port} failed (98: Address already in use)`;
    }
  }

  return null;
}

export function startService(state: SystemState, name: string): StartOutcome {
  const service = findService(state, name);
  if (!service) return { ok: false, reason: "unit not found" };
  if (service.state === "active") return { ok: true };

  addLog(state, {
    tag: "systemd",
    pid: 1,
    unit: service.name,
    message: `Starting ${service.name}.service - ${service.description}...`,
  });

  const reason = blockingReason(state, service);
  if (reason) {
    service.state = "failed";
    service.mainPid = undefined;
    service.since = state.clock;
    service.lastExitReason = reason;
    addLog(state, { tag: service.name, unit: service.name, priority: "err", message: reason });
    addLog(state, {
      tag: "systemd",
      pid: 1,
      unit: service.name,
      priority: "err",
      message: `${service.name}.service: Control process exited, code=exited, status=1/FAILURE`,
    });
    addLog(state, {
      tag: "systemd",
      pid: 1,
      unit: service.name,
      priority: "err",
      message: `Failed to start ${service.name}.service - ${service.description}.`,
    });
    return { ok: false, reason };
  }

  const pid = nextPid(state);
  service.state = "active";
  service.mainPid = pid;
  service.since = state.clock;
  service.lastExitReason = undefined;
  state.processes.push({
    pid,
    user: "root",
    cpu: service.cpu,
    memKB: service.memKB,
    command: service.execStart,
    listenPorts: service.listenPorts,
    service: service.name,
  });
  addLog(state, {
    tag: "systemd",
    pid: 1,
    unit: service.name,
    message: `Started ${service.name}.service - ${service.description}.`,
  });
  return { ok: true };
}

export function stopService(state: SystemState, name: string): boolean {
  const service = findService(state, name);
  if (!service) return false;
  state.processes = state.processes.filter((p) => p.service !== service.name);
  service.state = "inactive";
  service.mainPid = undefined;
  service.since = state.clock;
  addLog(state, {
    tag: "systemd",
    pid: 1,
    unit: service.name,
    message: `Stopped ${service.name}.service - ${service.description}.`,
  });
  return true;
}
