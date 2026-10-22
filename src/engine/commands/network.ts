/** 네트워크 명령어들: curl, ss, ufw */
import { hasFlag, positionals } from "../parser/parse";
import { unknownBooleanOption } from "./booleanOptions";
import { listeningSockets } from "../state/derived";
import { table } from "../state/format";
import { addLog } from "../state/log";
import { request } from "../state/network";
import type { FirewallRule } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

interface ParsedUrl {
  host: string;
  port: number;
  path: string;
  tls: boolean;
}

/** "https://api.example.com/health" 같은 주소를 뜯는다. 스킴이 없으면 http로 본다. */
function parseUrl(raw: string): ParsedUrl | null {
  const match = /^(?:(https?):\/\/)?([^/:\s]+)(?::(\d+))?(\/.*)?$/.exec(raw);
  if (!match) return null;
  const tls = match[1] === "https";
  return {
    host: match[2],
    port: match[3] ? Number(match[3]) : tls ? 443 : 80,
    path: match[4] ?? "/",
    tls,
  };
}

/** 응답 줄의 이유 문구. 실제 서버처럼 "404 Not Found"로 보여준다. */
const REASON_PHRASES: Record<number, string> = {
  200: "OK", 301: "Moved Permanently", 302: "Found", 400: "Bad Request", 401: "Unauthorized",
  403: "Forbidden", 404: "Not Found", 500: "Internal Server Error", 502: "Bad Gateway",
  503: "Service Unavailable", 504: "Gateway Timeout",
};

const CURL_VALUE_OPTIONS = [
  "m", "max-time", "connect-timeout", "o", "output", "H", "header", "X", "request",
  "A", "user-agent", "d", "data", "u", "user", "w", "write-out", "resolve", "cacert",
];

export const curl: Command = {
  name: "curl",
  summary: "HTTP 요청을 보낸다 (-I 헤더만, -i 헤더+본문, -v 자세히)",
  usage: "curl [-I] [-i] [-v] <URL>",
  run({ state, tokens }: CommandContext) {
    // 값을 받는 옵션("--max-time 5")의 값을 URL로 읽지 않도록 건너뛴다.
    // 시간 제한·헤더 같은 옵션은 가상 요청 결과에 영향을 주지 않지만, 실제 curl처럼 받아들여야 한다.
    const target = positionals(tokens, CURL_VALUE_OPTIONS)[0];
    if (!target) return fail("curl: try 'curl --help' for more information", 2);

    const url = parseUrl(target);
    if (!url) return fail(`curl: (3) URL using bad/illegal format or missing URL`, 3);

    const headOnly = hasFlag(tokens, "I", "head");
    const verbose = hasFlag(tokens, "v", "verbose");
    const include = hasFlag(tokens, "i", "include");
    const outcome = request(state, { host: url.host, port: url.port, tls: url.tls, path: url.path });

    if (!outcome.ok) {
      // curl의 실제 에러 코드를 그대로 쓴다. 이 숫자 자체가 단서가 된다.
      const codes: Record<string, number> = { dns: 6, tls: 60, refused: 7, reset: 56 };
      const code = codes[outcome.stage ?? ""] ?? 28;
      const detail =
        outcome.stage === "dns"
          ? `Could not resolve host: ${url.host}`
          : (outcome.message ?? "connection failed");
      return fail(`curl: (${code}) ${detail}`, code);
    }

    const lines: string[] = [];
    if (verbose) {
      lines.push(`*   Trying ${outcome.ip}:${url.port}...`);
      lines.push(`* Connected to ${url.host} (${outcome.ip}) port ${url.port}`);
      if (url.tls) lines.push("* TLS connection established");
      lines.push(`> GET ${url.path} HTTP/1.1`, `> Host: ${url.host}`, ">");
    }

    const headers = outcome.headers ?? { Server: "nginx/1.24.0", "Content-Type": "text/html" };
    const header = [
      `HTTP/1.1 ${outcome.status} ${REASON_PHRASES[outcome.status ?? 200] ?? ""}`.trim(),
      ...Object.entries(headers).map(([key, value]) => `${key}: ${value}`),
      `Content-Length: ${(outcome.body ?? "").length}`,
    ].join("\n");

    if (headOnly) return ok([...lines, header].join("\n"));
    return ok([...lines, verbose || include ? header : "", outcome.body ?? ""].filter(Boolean).join("\n").trimEnd());
  },
};

export const ss: Command = {
  name: "ss",
  summary: "열려 있는 포트와 그 주인을 본다 (-tlnp)",
  usage: "ss -tlnp",
  run({ state }: CommandContext) {
    const rows = [["State", "Recv-Q", "Send-Q", "Local Address:Port", "Peer Address:Port", "Process"]];
    for (const socket of listeningSockets(state)) {
      rows.push([
        "LISTEN",
        "0",
        "511",
        `${socket.addr}:${socket.port}`,
        "0.0.0.0:*",
        `users:(("${socket.program}",pid=${socket.pid},fd=6))`,
      ]);
    }
    return ok(table(rows, ["left", "left", "left", "left", "left", "left"]));
  },
};

/** "80/tcp", "443", "http" 같은 입력을 포트 번호로 바꾼다. */
function parsePortSpec(spec: string): { port: number; proto: "tcp" | "udp" } | null {
  const named: Record<string, number> = { http: 80, https: 443, ssh: 22 };
  const [portPart, protoPart, extra] = spec.split("/");
  const port = named[portPart] ?? Number(portPart);
  if (!Number.isInteger(port) || port <= 0 || port > 65535 || extra !== undefined) return null;
  if (protoPart !== undefined && protoPart !== "tcp" && protoPart !== "udp") return null;
  return { port, proto: protoPart === "udp" ? "udp" : "tcp" };
}

export const ufw: Command = {
  name: "ufw",
  summary: "방화벽 규칙을 보고 바꾼다 (status / allow / deny)",
  usage: "ufw <status [verbose] | allow <포트> | deny <포트> | enable | disable>",
  run({ state, tokens, user }: CommandContext) {
    const unknown = unknownBooleanOption(tokens, "");
    if (unknown) return fail(`ERROR: Invalid option '${unknown}'`);
    const args = positionals(tokens);
    const sub = args[0] ?? "status";
    const { firewall } = state.network;

    if (sub === "status") {
      if (user !== "root") return fail("ERROR: You need to be root to run this script", 1);
      if (!firewall.enabled) return ok("Status: inactive");

      const header = ["Status: active", ""];
      if (args[1] === "verbose") {
        header.push(
          "Logging: on (low)",
          `Default: ${firewall.defaultIncoming} (incoming), ${firewall.defaultOutgoing} (outgoing), disabled (routed)`,
          "New profiles: skip",
          "",
        );
      }

      const rows = [["To", "Action", "From"], ["--", "------", "----"]];
      for (const rule of firewall.rules) {
        rows.push([
          `${rule.port}/${rule.proto}`,
          rule.action === "allow" ? "ALLOW IN" : "DENY IN",
          rule.from ?? "Anywhere",
        ]);
      }
      return ok([...header, table(rows, ["left", "left", "left"])].join("\n"));
    }

    if (sub === "allow" || sub === "deny") {
      if (user !== "root") return fail("ERROR: You need to be root to run this script", 1);
      const spec = args[1];
      if (!spec || args.length !== 2) return fail("ERROR: Wrong number of arguments", 1);
      const parsed = parsePortSpec(spec);
      if (!parsed) return fail(`ERROR: Bad port '${spec}'`, 1);

      const rule: FirewallRule = { port: parsed.port, proto: parsed.proto, action: sub };
      const existing = firewall.rules.findIndex((r) => r.port === rule.port && r.proto === rule.proto);
      const unchanged = existing !== -1 && firewall.rules[existing].action === sub;

      if (existing === -1) firewall.rules.push(rule);
      else firewall.rules[existing] = { ...firewall.rules[existing], action: sub };
      firewall.rules.sort((a, b) => a.port - b.port);

      addLog(state, { tag: "ufw", message: `rule ${sub === "allow" ? "added" : "updated"}: ${spec}` });
      return ok(unchanged ? "Skipping adding existing rule" : "Rule added");
    }

    if (sub === "enable" || sub === "disable") {
      if (user !== "root") return fail("ERROR: You need to be root to run this script", 1);
      firewall.enabled = sub === "enable";
      return ok(sub === "enable" ? "Firewall is active and enabled on system startup" : "Firewall stopped and disabled on system startup");
    }

    return fail("ERROR: Invalid syntax", 1);
  },
};
