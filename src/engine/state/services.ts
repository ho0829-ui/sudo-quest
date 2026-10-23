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
import { nginxTlsProblem } from "./config/nginxSites";
import { daemonStarted, daemonStopped } from "./docker/lifecycle";
import { diskUsage, nextPid, portOwner } from "./derived";
import { findNode } from "./fs";
import { fdUsage } from "./limits";
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

  return configProblem(state, service) ?? portProblem(state, service.listenPorts ?? [], service.mainPid);
}

/** 설정 파일 문법 검사. nginx -t 와 똑같은 함수를 쓰므로 결과가 어긋나지 않는다. */
function configProblem(state: SystemState, service: Service): string | null {
  if (!service.configPath || !service.configValidator) return null;
  const node = findNode(state.fs, service.configPath);
  if (!node || node.kind !== "file") {
    return `open() "${service.configPath}" failed (2: No such file or directory)`;
  }
  const check = configValidators[service.configValidator](node.content);
  if (!check.ok && check.error) {
    return `[emerg] ${check.error.message} in ${service.configPath}:${check.error.line}`;
  }
  // 문법이 맞아도 인증서·키를 읽지 못하면 시작하지 못한다.
  return service.configValidator === "nginx" ? nginxTlsProblem(state, node.content) : null;
}

/** 시작·reload에 성공한 순간의 설정 내용을 기억한다. 이후 요청은 이 내용으로 처리한다. */
function snapshotConfig(state: SystemState, service: Service) {
  if (!service.configPath) return;
  const node = findNode(state.fs, service.configPath);
  if (node?.kind === "file") service.configSnapshot = node.content;
}

function portProblem(state: SystemState, ports: { addr: string; port: number }[], ownPid?: number): string | null {
  for (const listen of ports) {
    const owner = portOwner(state, listen.addr, listen.port);
    // 자기 자신이 이미 쓰고 있는 건 충돌이 아니다
    if (owner && owner.pid !== ownPid) {
      return `bind() to ${listen.addr}:${listen.port} failed (98: Address already in use)`;
    }
  }
  return null;
}

/**
 * 서비스가 실제로 열 포트를 정한다.
 *
 * bindConfig가 있으면 설정 파일에서 바인드 주소를 읽어 쓴다.
 * 그래서 설정 파일을 고치고 재시작하면 ss -tlnp 결과가 따라 바뀐다.
 * (설정만 고치고 재시작을 안 하면 아무것도 바뀌지 않는 것도 실제와 같다)
 */
function effectiveListenPorts(state: SystemState, service: Service) {
  const ports = service.listenPorts ?? [];
  if (!service.bindConfig) return ports;

  const node = findNode(state.fs, service.bindConfig.path);
  if (!node || node.kind !== "file") return ports;

  // "host: 0.0.0.0" 또는 "host = 0.0.0.0" 형태를 읽는다. portKey가 있으면 포트도 설정 파일 값을 쓴다.
  const read = (key: string) => new RegExp(`^\\s*${key}\\s*[:=]\\s*([^\\s#]+)`, "m").exec(node.content)?.[1];
  const addr = read(service.bindConfig.key);
  const port = service.bindConfig.portKey ? Number(read(service.bindConfig.portKey)) : NaN;
  return ports.map((listen) => ({ ...listen, addr: addr ?? listen.addr, port: Number.isInteger(port) && port > 0 ? port : listen.port }));
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
  snapshotConfig(state, service);
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
    listenPorts: effectiveListenPorts(state, service),
    service: service.name,
    // 한도는 마지막 daemon-reload 때 읽은 unit 설정을 따른다. 파일만 고치고 reload를 안 하면 옛 값이다.
    ...(service.loaded?.nofile ? { nofile: { ...service.loaded.nofile } } : {}),
  });
  addLog(state, {
    tag: "systemd",
    pid: 1,
    unit: service.name,
    message: `Started ${service.name}.service - ${service.description}.`,
  });
  // dockerd가 다시 뜨면 재시작 정책에 따라 컨테이너를 되살린다(state/docker/lifecycle.ts).
  if (service.name === "docker") daemonStarted(state);
  // 필요한 연결이 한도보다 많으면 곧바로 다시 막힌다. 재시작만으로는 고쳐지지 않는다.
  const started = state.processes.find((p) => p.pid === pid)!;
  if (service.fdExhaustedLog && fdUsage(state, started).saturated) {
    addLog(state, { tag: service.name, unit: service.name, pid, priority: "err", message: service.fdExhaustedLog });
  }
  return { ok: true };
}

export function stopService(state: SystemState, name: string): boolean {
  const service = findService(state, name);
  if (!service) return false;
  if (service.name === "docker") daemonStopped(state);
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

export type ReloadOutcome = { ok: true } | { ok: false; why: "inactive" | "not-applicable" | "rejected"; reason?: string };

/**
 * reload: 실행 중인 서비스가 설정만 다시 읽는다.
 * 새 설정이 잘못되면 거부하고 기존 프로세스를 그대로 둔다. 그래서 운영 중엔 restart보다 안전하다
 * (restart는 일단 죽이고 새로 띄우므로 설정 오타가 곧 장애가 된다).
 * 설정 파일이 없는 서비스는 실제 systemd처럼 reload를 지원하지 않는다.
 */
export function reloadService(state: SystemState, name: string): ReloadOutcome {
  const service = findService(state, name);
  if (!service || !service.configPath) return { ok: false, why: "not-applicable" };
  if (service.state !== "active") return { ok: false, why: "inactive" };

  addLog(state, { tag: "systemd", pid: 1, unit: service.name, message: `Reloading ${service.name}.service - ${service.description}...` });
  const ports = effectiveListenPorts(state, service);
  const reason = configProblem(state, service) ?? portProblem(state, ports, service.mainPid);
  if (reason) {
    addLog(state, { tag: service.name, unit: service.name, priority: "err", message: reason });
    addLog(state, {
      tag: "systemd", pid: 1, unit: service.name, priority: "err",
      message: `${service.name}.service: Control process exited, code=exited, status=1/FAILURE`,
    });
    addLog(state, { tag: "systemd", pid: 1, unit: service.name, priority: "err", message: `Reload failed for ${service.name}.service - ${service.description}.` });
    return { ok: false, why: "rejected", reason };
  }

  const process = state.processes.find((p) => p.pid === service.mainPid);
  if (process) process.listenPorts = ports;
  snapshotConfig(state, service);
  addLog(state, { tag: "systemd", pid: 1, unit: service.name, message: `Reloaded ${service.name}.service - ${service.description}.` });
  return { ok: true };
}
