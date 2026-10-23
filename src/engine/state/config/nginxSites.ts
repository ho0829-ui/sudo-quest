/**
 * nginx 설정의 뜻을 읽는다(문법 검사는 nginx.ts). server·location·upstream·proxy_pass·root·ssl_certificate만 해석한다.
 * 요청 처리는 nginx가 시작·reload 때 읽어 둔 설정(Service.configSnapshot)을 따른다. 파일만 고치고 reload를 안 하면 옛 설정 그대로다.
 */
import { keyMatches } from "../certs";
import { findNode } from "../fs";
import type { Service, SystemState } from "../types";

interface Statement { name: string; args: string[]; children?: Statement[] }

export interface NginxLocation { prefix: string; exact: boolean; proxyPass?: string; root?: string }
export interface NginxServer {
  listen: { port: number; ssl: boolean; isDefault: boolean }[];
  names: string[];
  certificate?: string;
  key?: string;
  locations: NginxLocation[];
}
export interface NginxConfig { servers: NginxServer[]; upstreams: Record<string, string[]> }

/** 주석을 지우고 { } ; 를 경계로 나눠 문장 트리를 만든다. 문법이 틀린 설정은 nginx.ts가 먼저 거른다. */
function statements(content: string): Statement[] {
  const tokens = content.split("\n").map(line => line.split("#")[0]).join(" ").match(/[{};]|[^\s{};]+/g) ?? [];
  let index = 0;
  const block = (): Statement[] => {
    const list: Statement[] = [];
    let words: string[] = [];
    while (index < tokens.length) {
      const token = tokens[index++];
      if (token === ";") { if (words.length) list.push({ name: words[0], args: words.slice(1) }); words = []; }
      else if (token === "{") { list.push({ name: words[0] ?? "", args: words.slice(1), children: block() }); words = []; }
      else if (token === "}") return list;
      else words.push(token);
    }
    return list;
  };
  return block();
}

export function parseNginx(content: string): NginxConfig {
  const config: NginxConfig = { servers: [], upstreams: {} };
  const visit = (list: Statement[]) => {
    for (const st of list) {
      if (st.name === "upstream" && st.children) {
        config.upstreams[st.args[0]] = st.children.filter(c => c.name === "server").map(c => c.args[0]);
      } else if (st.name === "server" && st.children) {
        const server: NginxServer = { listen: [], names: [], locations: [] };
        for (const c of st.children) {
          if (c.name === "listen") {
            const port = Number(/(\d+)$/.exec(c.args[0] ?? "")?.[1] ?? 80);
            server.listen.push({ port, ssl: c.args.includes("ssl"), isDefault: c.args.includes("default_server") });
          } else if (c.name === "server_name") server.names.push(...c.args);
          else if (c.name === "ssl_certificate") server.certificate = c.args[0];
          else if (c.name === "ssl_certificate_key") server.key = c.args[0];
          else if (c.name === "location" && c.children) {
            const exact = c.args[0] === "=";
            const prefix = exact ? c.args[1] : c.args[0];
            const get = (name: string) => c.children!.find(x => x.name === name)?.args[0];
            server.locations.push({ prefix, exact, proxyPass: get("proxy_pass"), root: get("root") });
          }
        }
        if (!server.listen.length) server.listen.push({ port: 80, ssl: false, isDefault: false });
        config.servers.push(server);
      } else if (st.children) visit(st.children);
    }
  };
  visit(statements(content));
  return config;
}

/** nginx가 지금 쓰고 있는 설정 내용. 시작·reload 때 저장한 것이 없으면 파일 그대로. */
export function loadedConfig(state: SystemState, service: Service): NginxConfig | null {
  if (!service.configPath) return null;
  const node = findNode(state.fs, service.configPath);
  const content = service.configSnapshot ?? (node?.kind === "file" ? node.content : "");
  return parseNginx(content);
}

/** 포트와 Host로 server 블록을 고른다. 이름이 맞는 것 → default_server → 그 포트의 첫 server 순서다(nginx 규칙). */
export function pickServer(config: NginxConfig, port: number, host: string): NginxServer | undefined {
  const onPort = config.servers.filter(s => s.listen.some(l => l.port === port));
  return onPort.find(s => s.names.includes(host)) ?? onPort.find(s => s.listen.some(l => l.port === port && l.isDefault)) ?? onPort[0];
}

export type Route = { kind: "static" } | { kind: "proxy"; targets: { host: string; port: number }[]; path: string };

/**
 * 경로에 맞는 location을 고른다(= 정확히 일치 우선, 그다음 가장 긴 접두사).
 * proxy_pass에 URI(끝의 / 포함)가 있으면 맞은 접두사를 그 URI로 바꾸고, 없으면 경로를 그대로 넘긴다(nginx 문서 규칙).
 */
export function route(config: NginxConfig, server: NginxServer, path: string): Route {
  const exact = server.locations.find(l => l.exact && l.prefix === path);
  const location = exact ?? [...server.locations].filter(l => !l.exact && path.startsWith(l.prefix)).sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!location?.proxyPass) return { kind: "static" };
  const match = /^https?:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/.exec(location.proxyPass);
  if (!match) return { kind: "static" };
  const [, name, port, uri] = match;
  const targets = (config.upstreams[name] ?? [`${name}:${port ?? 80}`]).map(entry => {
    const [host, p = "80"] = entry.split(":");
    return { host, port: Number(p) };
  });
  return { kind: "proxy", targets, path: uri === undefined ? path : uri + path.slice(location.prefix.length) };
}

const ERROR_TITLE: Record<number, string> = { 502: "502 Bad Gateway", 504: "504 Gateway Time-out" };

/** nginx 기본 오류 페이지 */
export function nginxErrorPage(status: 502 | 504): string {
  const title = ERROR_TITLE[status];
  return `<html>\n<head><title>${title}</title></head>\n<body>\n<center><h1>${title}</h1></center>\n<hr><center>nginx/1.24.0</center>\n</body>\n</html>`;
}

/**
 * 문법은 맞지만 nginx가 시작할 수 없는 설정(인증서·키 파일 없음, 키가 인증서와 짝이 아님).
 * 실제 nginx -t·시작·reload가 내는 문장과 같다. 서비스 시작 판정과 nginx -t가 이 함수를 함께 쓴다.
 */
export function nginxTlsProblem(state: SystemState, content: string): string | null {
  for (const server of parseNginx(content).servers) {
    if (!server.certificate) continue;
    const cert = findNode(state.fs, server.certificate);
    if (cert?.kind !== "file") {
      return `[emerg] cannot load certificate "${server.certificate}": BIO_new_file() failed (SSL: error:80000002:system library::No such file or directory:calling fopen(${server.certificate}, r) error:10000080:BIO routines::no such file)`;
    }
    if (server.key && !keyMatches(state, server.certificate, server.key)) {
      return `[emerg] SSL_CTX_use_PrivateKey("${server.key}") failed (SSL: error:05800074:x509 certificate routines::key values mismatch)`;
    }
  }
  return null;
}
