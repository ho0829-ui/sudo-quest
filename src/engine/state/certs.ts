/**
 * 인증서 체인. nginx가 보내는 체인은 ssl_certificate 파일 "내용"에 든 인증서들의 순서다.
 * 클라이언트(curl·openssl)는 루트만 믿으므로, 서버가 중간 인증서를 빠뜨리면 루트까지 잇지 못해 검증에 실패한다.
 */
import { findNode } from "./fs";
import type { Certificate, SystemState } from "./types";

export const subjectOf = (cert: Certificate) => cert.subject ?? `CN = ${cert.domain}`;

/** 파일 내용에 PEM이 든 인증서들을 파일 안 순서대로. 이 방식으로 정의되지 않은 예전 인증서는 경로로 찾는다. */
export function certsInFile(state: SystemState, path: string): Certificate[] {
  const node = findNode(state.fs, path);
  const content = node?.kind === "file" ? node.content : "";
  const found = state.certificates
    .filter(c => c.pem && content.includes(c.pem))
    .sort((a, b) => content.indexOf(a.pem!) - content.indexOf(b.pem!));
  if (found.length) return found;
  const legacy = state.certificates.find(c => c.path === path && !c.pem);
  return legacy ? [legacy] : [];
}

export type ChainVerdict =
  | { ok: true; depth: Certificate[] }
  | { ok: false; code: 10 | 20 | 21; reason: string; depth: Certificate[] };

/**
 * 첫 인증서(서버 인증서)부터 발급자를 따라 올라가 믿는 루트에 닿는지 본다.
 * 예전 방식 인증서(PEM 정보 없음)는 체인이 온전하다고 보고 만료만 본다.
 */
export function verifyChain(state: SystemState, chain: Certificate[]): ChainVerdict {
  const leaf = chain[0];
  if (leaf.notAfter < state.clock) return { ok: false, code: 10, reason: "certificate has expired", depth: [leaf] };
  if (!leaf.pem) return { ok: true, depth: [leaf] };
  const roots = state.network.trustedRoots ?? [];
  const path: Certificate[] = [leaf];
  let current = leaf;
  while (!roots.includes(current.issuer)) {
    const next = chain.find(c => c !== current && subjectOf(c) === current.issuer);
    // 중간 인증서가 없으면 0단계에서 막힌다: 20(발급자를 찾지 못함) 뒤에 21(첫 인증서를 검증하지 못함)
    if (!next || path.includes(next)) return { ok: false, code: path.length === 1 ? 21 : 20, reason: "unable to get local issuer certificate", depth: path };
    path.push(next);
    current = next;
  }
  return { ok: true, depth: path };
}

/** 인증서 파일의 첫 인증서와 키 파일이 짝인가. 순서를 거꾸로 합치면 첫 인증서가 중간 인증서라 짝이 맞지 않는다. */
export function keyMatches(state: SystemState, certPath: string, keyPath: string): boolean {
  const first = certsInFile(state, certPath)[0];
  // 예전 방식 인증서(PEM 정보 없음)는 키 짝을 따지지 않는다. 새 방식인데 키 정보가 없으면(중간 인증서) 짝이 아니다.
  if (!first?.pem) return true;
  if (!first.keyId) return false;
  const key = findNode(state.fs, keyPath);
  return key?.kind === "file" && key.content.includes(first.keyId);
}
