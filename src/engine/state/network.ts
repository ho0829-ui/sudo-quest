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
import { fdUsage, serviceOf } from "./limits";
import { verifyChain } from "./certs";
import { loadedConfig, pickServer, route } from "./config/nginxSites";
import { proxy, serveLocal, servedChain } from "./webServer";

// 예전부터 network.ts에서 가져가던 이름들은 그대로 쓸 수 있게 다시 내보낸다.
export { certificateFor, servedChain, serveLocal, WEB_ROOT, WEB_USER } from "./webServer";
export { configuredNameserver, resolveHost, type ResolveOutcome } from "./dns";
import { listeningSockets } from "./derived";
import { resolveHost } from "./dns";
import type { FirewallRule, SystemState } from "./types";

export type FailureStage = "dns" | "firewall" | "unreachable" | "refused" | "reset" | "timeout" | "tls";

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
  /** nginx가 다시 넘긴 횟수. 자기 자신으로 넘기는 설정이 끝없이 돌지 않게 막는다. */
  hops?: number;
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
    const owner = state.processes.find((p) => p.pid === socket.pid);
    // fd 한도에 막힌 프로세스는 accept를 못 해 연결이 대기열에서 기다리다 시간 초과된다.
    if (owner && fdUsage(state, owner).saturated) {
      return { ok: false, ip, stage: "timeout", message: "Operation timed out after 5001 milliseconds with 0 bytes received" };
    }
    // docker-proxy가 잡은 포트면 응답은 그 컨테이너가 만든다(nginx 웹 루트가 아니다).
    const forwarder = owner?.container;
    if (forwarder) {
      const reply = containerResponse(state.docker, forwarder, target.path ?? "/", state.clock);
      if (!reply) return { ok: false, ip, stage: "reset", message: "Recv failure: Connection reset by peer" };
      return { ok: true, ip, ...reply };
    }
    // 응답을 정의한 서비스(예: Node API)면 그 서비스가 답한다.
    const http = owner && serviceOf(state, owner)?.http;
    if (http) {
      const body = http.responses[(target.path ?? "/").split("?")[0]];
      const headers = http.headers ?? { "Content-Type": "application/json; charset=utf-8" };
      return body === undefined ? { ok: true, ip, status: 404, body: '{"error":"not found"}', headers } : { ok: true, ip, status: 200, body, headers };
    }
    // 우리 서버의 인증서: nginx가 보내는 체인으로 만료와 루트까지 이어지는지를 검사한다.
    if (target.tls) {
      const chain = servedChain(state, target.host, target.port);
      const verdict = chain.length ? verifyChain(state, chain) : null;
      if (verdict && !verdict.ok) {
        const problem = verdict.code === 10 ? "certificate has expired" : "unable to get local issuer certificate";
        return { ok: false, ip, stage: "tls", message: `SSL certificate problem: ${problem}` };
      }
    }
    // nginx면 읽어 둔 설정의 location에 따라 정적 파일을 주거나 upstream으로 넘긴다.
    const nginx = owner && serviceOf(state, owner)?.name === "nginx" ? serviceOf(state, owner) : undefined;
    const config = nginx && loadedConfig(state, nginx);
    const server = config ? pickServer(config, target.port, target.host) : undefined;
    const path = target.path ?? "/";
    const plan = config && server ? route(config, server, path) : { kind: "static" as const };
    if (plan.kind === "proxy") return proxy(ip, plan.targets, plan.path, (target.hops ?? 0) + 1, (next) => request(state, next));
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
