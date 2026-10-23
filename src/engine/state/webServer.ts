/**
 * 우리 서버(web-01)의 웹 서버 쪽 계산: nginx의 proxy_pass, 내보내는 인증서 체인, 정적 파일 응답.
 * 요청 흐름 전체(이름 해석 → 방화벽 → 소켓)는 network.ts의 request가 맡고, 로컬 nginx에 닿은 뒤의 일을 여기서 한다.
 */
import { certsInFile } from "./certs";
import { loadedConfig, nginxErrorPage, pickServer } from "./config/nginxSites";
import { canRead, findNode } from "./fs";
import type { RequestOutcome, RequestTarget } from "./network";
import { findService } from "./services";
import type { Certificate, SystemState } from "./types";

/**
 * nginx의 proxy_pass: upstream 서버를 차례로 시도한다. 모두 연결을 거부하면 502, 시간 초과면 504.
 * 응답 헤더의 Server는 nginx 것으로 바뀐다(실제와 같다). 다시 요청하는 함수(send)는 network.ts가 넘긴다.
 */
export function proxy(ip: string, targets: { host: string; port: number }[], path: string, hops: number,
  send: (target: RequestTarget) => RequestOutcome): RequestOutcome {
  const html = { Server: "nginx/1.24.0", "Content-Type": "text/html" };
  let timedOut = false;
  if (hops <= 5) {
    for (const upstream of targets) {
      const reply = send({ host: upstream.host, port: upstream.port, path, hops });
      if (reply.ok) {
        const { Server: _ignored, ...rest } = reply.headers ?? { "Content-Type": "text/html" };
        return { ok: true, ip, status: reply.status, body: reply.body, headers: { Server: "nginx/1.24.0", ...rest } };
      }
      if (reply.stage === "timeout") timedOut = true;
    }
  }
  const status = timedOut ? 504 : 502;
  return { ok: true, ip, status, body: nginxErrorPage(status), headers: html };
}

/** nginx가 이 이름·포트로 보내는 인증서 체인. ssl 설정이 없는 예전 실습은 도메인으로 찾은 인증서 한 장이다. */
export function servedChain(state: SystemState, host: string, port: number): Certificate[] {
  const nginx = findService(state, "nginx");
  const config = nginx?.state === "active" ? loadedConfig(state, nginx) : null;
  const server = config ? pickServer(config, port, host) : undefined;
  if (server?.certificate) return certsInFile(state, server.certificate);
  const legacy = certificateFor(state, host);
  return legacy ? [legacy] : [];
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
