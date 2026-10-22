/** 이름 해석: /etc/resolv.conf의 nameserver가 살아 있어야 하고, 가상 DNS에 레코드가 있어야 한다. dig와 request가 함께 쓴다. */
import { findNode } from "./fs";
import type { FailureStage } from "./network";
import type { SystemState } from "./types";

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
