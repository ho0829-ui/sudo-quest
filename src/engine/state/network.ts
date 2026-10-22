/**
 * 네트워크 요청 체인.
 *
 * curl, ping, dig 를 따로 만들지 않고 전부 이 한 경로를 통과시킨다.
 *
 *   이름 해석 → 목적지 판별(로컬/원격) → 방화벽 → 리스닝 확인 → TLS 확인 → 응답
 *
 * 각 단계가 실패할 때 실제 명령이 내는 에러를 그대로 돌려주면,
 * "어느 단계에서 막혔는가"를 플레이어가 출력만 보고 좁혀 들어갈 수 있다.
 */
import { requestInstance } from "./aws";
import { containerResponse } from "./docker/runtime";
import { listeningSockets } from "./derived";
import { canRead, findNode } from "./fs";
import type { FirewallRule, SystemState } from "./types";

export type FailureStage = "dns" | "firewall" | "unreachable" | "refused" | "reset" | "tls";

export interface RequestOutcome {
  ok: boolean;
  ip?: string;
  status?: number;
  body?: string;
  /** 어느 단계에서 막혔는가 */
  stage?: FailureStage;
  /** 실패 사유를 사람이 읽는 문장으로 */
  message?: string;
  /** 응답 헤더. 없으면 우리 서버의 nginx 기본 헤더를 쓴다. */
  headers?: Record<string, string>;
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** /etc/resolv.conf 에 적힌 첫 번째 nameserver */
export function configuredNameserver(state: SystemState): string | null {
  const node = findNode(state.fs, "/etc/resolv.conf");
  if (!node || node.kind !== "file") return null;
  const line = node.content.split("\n").find((l) => l.trim().startsWith("nameserver"));
  return line ? (line.trim().split(/\s+/)[1] ?? null) : null;
}

export interface ResolveOutcome {
  ip?: string;
  stage?: FailureStage;
  message?: string;
  /** 어떤 DNS 서버에 물어봤는가 (dig 출력에 쓴다) */
  nameserver?: string;
}

/** 이름 해석. 설정된 nameserver가 살아 있어야 하고, 레코드도 있어야 한다. */
export function resolveHost(state: SystemState, host: string): ResolveOutcome {
  if (IPV4.test(host) || host === "localhost") {
    return { ip: host === "localhost" ? "127.0.0.1" : host };
  }

  const nameserver = configuredNameserver(state);
  if (!nameserver) {
    return { stage: "dns", message: "Temporary failure in name resolution" };
  }
  // 설정된 DNS 서버가 실제로 응답하는 서버가 아니면 타임아웃된다.
  // resolv.conf를 잘못 고쳤을 때 실제로 벌어지는 일이다.
  if (!state.network.dnsServers.includes(nameserver)) {
    return { stage: "dns", nameserver, message: "Temporary failure in name resolution" };
  }

  const ip = state.network.records[host];
  if (!ip) return { stage: "dns", nameserver, message: "Name or service not known" };
  return { ip, nameserver };
}

/** 이 주소가 우리 서버 자신인가 */
export function isLocalAddress(state: SystemState, ip: string): boolean {
  return state.network.interfaces.some((iface) => iface.addr === ip);
}

/** 들어오는 연결을 방화벽이 허용하는가. 외부에서 우리 서버로 접속할 때의 판정. */
export function inboundAllowed(state: SystemState, port: number): boolean {
  const { firewall } = state.network;
  if (!firewall.enabled) return true;
  const rule = matchRule(firewall.rules, port);
  if (rule) return rule.action === "allow";
  return firewall.defaultIncoming === "allow";
}

function matchRule(rules: FirewallRule[], port: number): FirewallRule | undefined {
  // 이 경로의 HTTP 요청과 복구 판정은 TCP다. 같은 번호의 UDP 허용 규칙은 관계없다.
  return rules.find((rule) => rule.port === port && rule.proto === "tcp");
}

export interface RequestTarget {
  host: string;
  port: number;
  /** https인가 (인증서 만료를 검사한다) */
  tls?: boolean;
  /** 요청 경로. 경로별로 응답이 다른 대상(EC2 인스턴스)에서 쓴다 */
  path?: string;
}

export function request(state: SystemState, target: RequestTarget): RequestOutcome {
  // 1) 이름 해석
  const resolved = resolveHost(state, target.host);
  if (!resolved.ip) return { ok: false, stage: resolved.stage, message: resolved.message };
  const ip = resolved.ip;

  // 2) 우리 서버 자신에게 거는 요청
  if (ip === "127.0.0.1" || isLocalAddress(state, ip)) {
    // 로컬 연결은 방화벽을 거치지 않는다.
    // "서버 안에서는 되는데 밖에서는 안 된다"가 여기서 자연스럽게 생긴다.
    const socket = listeningSockets(state).find(
      (s) => s.port === target.port && (s.addr === "0.0.0.0" || s.addr === ip),
    );
    if (!socket) {
      return {
        ok: false,
        ip,
        stage: "refused",
        message: `Failed to connect to ${target.host} port ${target.port}: Connection refused`,
      };
    }
    // docker-proxy가 잡은 포트면 응답은 그 컨테이너가 만든다(nginx 웹 루트가 아니다).
    const forwarder = state.processes.find((p) => p.pid === socket.pid)?.container;
    if (forwarder) {
      const reply = containerResponse(state.docker, forwarder, target.path ?? "/", state.clock);
      if (!reply) return { ok: false, ip, stage: "reset", message: "Recv failure: Connection reset by peer" };
      return { ok: true, ip, ...reply };
    }
    // 우리 서버의 인증서도 만료를 검사한다. 원격이든 로컬이든 규칙은 같다.
    if (target.tls) {
      const cert = certificateFor(state, target.host);
      if (cert && cert.notAfter < state.clock) {
        return { ok: false, ip, stage: "tls", message: "SSL certificate problem: certificate has expired" };
      }
    }
    return { ok: true, ip, ...serveLocal(state) };
  }

  // 3) 바깥으로 나가는 요청
  const { firewall } = state.network;
  if (firewall.enabled && firewall.defaultOutgoing === "deny" && !matchRule(firewall.rules, target.port)) {
    return { ok: false, ip, stage: "firewall", message: "Connection timed out" };
  }

  // VPC 안의 EC2 인스턴스는 보안그룹과 서빙 경로로 응답을 계산한다(state/aws.ts).
  const sourceIp = state.network.interfaces.find((i) => i.name !== "lo")?.addr ?? "127.0.0.1";
  const instance = requestInstance(state, ip, target.port, target.path ?? "/", sourceIp);
  if (instance) {
    return instance.reachable
      ? { ok: true, ip, status: instance.status, body: instance.body }
      : { ok: false, ip, stage: "unreachable", message: "Connection timed out" };
  }

  const remote = state.network.world.find((h) => h.ip === ip);
  if (!remote) {
    return { ok: false, ip, stage: "unreachable", message: "Connection timed out" };
  }

  const service = remote.services.find((s) => s.port === target.port);
  if (!service) {
    return {
      ok: false,
      ip,
      stage: "refused",
      message: `Failed to connect to ${target.host} port ${target.port}: Connection refused`,
    };
  }

  // 4) TLS 인증서 만료 검사
  if (target.tls && service.tlsExpiresAt !== undefined && service.tlsExpiresAt < state.clock) {
    return {
      ok: false,
      ip,
      stage: "tls",
      message: "SSL certificate problem: certificate has expired",
    };
  }

  return { ok: true, ip, status: service.status ?? 200, body: service.body ?? "" };
}

/** 이 도메인을 담당하는 인증서를 찾는다. */
export function certificateFor(state: SystemState, domain: string) {
  return state.certificates.find((cert) => cert.domain === domain);
}

/** nginx가 파일을 읽을 때 쓰는 계정. 이 계정이 읽을 수 없으면 403이 난다. */
export const WEB_USER = "www-data";
export const WEB_ROOT = "/var/www/html/index.html";

/**
 * 우리 서버의 웹 응답을 만든다.
 *
 * 웹 루트 파일의 퍼미션을 실제로 검사한다.
 * 그래서 chmod 한 번으로 403 ↔ 200 이 오간다. 시나리오가 응답 코드를 정하지 않는다.
 */
export function serveLocal(state: SystemState): { status: number; body: string } {
  const node = findNode(state.fs, WEB_ROOT);
  if (!node || node.kind !== "file") {
    return { status: 404, body: "<html>\n<head><title>404 Not Found</title></head>\n</html>\n" };
  }
  if (!canRead(node, WEB_USER)) {
    return {
      status: 403,
      body: "<html>\n<head><title>403 Forbidden</title></head>\n<body>\n<center><h1>403 Forbidden</h1></center>\n<hr><center>nginx/1.24.0</center>\n</body>\n</html>\n",
    };
  }
  return { status: 200, body: node.content };
}
