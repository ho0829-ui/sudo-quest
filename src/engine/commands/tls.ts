/** TLS 인증서 명령어: openssl, certbot */
import { hasFlag, positionals } from "../parser/parse";
import { unknownBooleanOption } from "./booleanOptions";
import { formatFullTime } from "../state/format";
import { addLog } from "../state/log";
import type { Certificate, SystemState } from "../state/types";
import { request, servedChain } from "../state/network";
import { certsInFile, subjectOf, verifyChain } from "../state/certs";
import { normalizePath } from "../state/fs";
import { fail, ok, type Command, type CommandContext } from "./types";

/** "Sep 11 09:15:00 2026 GMT" — openssl이 쓰는 날짜 형식 */
function opensslDate(epochMs: number): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${months[d.getUTCMonth()]} ${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${d.getUTCFullYear()} GMT`;
}

/**
 * openssl은 다른 명령들과 옵션 표기가 다르다.
 * 대시 하나에 긴 이름을 쓴다: -in, -enddate, -noout
 * 그래서 공용 플래그 헬퍼 대신 전용으로 읽는다.
 */
const hasOpt = (tokens: string[], name: string) =>
  tokens.includes(`-${name}`) || tokens.includes(`--${name}`);

function optValue(tokens: string[], name: string): string | undefined {
  const index = tokens.findIndex((t) => t === `-${name}` || t === `--${name}`);
  return index === -1 ? undefined : tokens[index + 1];
}

function describe(cert: Certificate, tokens: string[]): string {
  const lines: string[] = [];
  // -dates는 -startdate와 -enddate를 함께 준 것과 같다.
  const wantEnd = hasOpt(tokens, "enddate") || hasOpt(tokens, "dates");
  const wantStart = hasOpt(tokens, "startdate") || hasOpt(tokens, "dates");
  const wantSubject = hasOpt(tokens, "subject");
  const wantIssuer = hasOpt(tokens, "issuer");
  const specific = wantEnd || wantStart || wantSubject || wantIssuer;

  if (wantStart || !specific) lines.push(`notBefore=${opensslDate(cert.notBefore)}`);
  if (wantEnd || !specific) lines.push(`notAfter=${opensslDate(cert.notAfter)}`);
  if (wantSubject || !specific) lines.push(`subject=${subjectOf(cert)}`);
  if (wantIssuer || !specific) lines.push(`issuer=${cert.issuer}`);
  return lines.join("\n");
}

export const openssl: Command = {
  name: "openssl",
  summary: "인증서 정보를 본다 (x509 -in <파일>, s_client -connect <호스트:포트>)",
  usage: "openssl x509 [-enddate] [-subject] [-issuer] [-noout] -in <인증서파일> | openssl s_client -connect <호스트:443>",
  run(ctx: CommandContext) {
    const { state, tokens } = ctx;
    if (tokens[0] === "s_client") return sClient(state, tokens);
    if (tokens[0] === undefined) return ok("help:\n\nStandard commands\ns_client          x509");
    if (tokens[0] !== "x509") return fail(`Invalid command '${tokens[0]}'; type "help" for a list.`, 1);

    // -in이 없으면 실제 openssl처럼 stdin에서 인증서를 읽으려 한다. 파이프 입력이 없으니 읽기에 실패한다.
    const path = optValue(tokens, "in");
    if (!path) return fail("Could not read certificate from <stdin>\nUnable to load certificate", 1);

    // 파일에 인증서가 여러 장이면(체인 묶음) 실제 openssl x509처럼 첫 장만 읽는다.
    const cert = certsInFile(state, normalizePath(state.cwd, path))[0];
    if (!cert) {
      return fail(`Could not open file or uri for loading certificate: ${path}`, 1);
    }
    return ok(describe(cert, tokens));
  },
};

/**
 * s_client: 서버에 TLS로 붙어 받은 인증서와 검증 결과를 보여 준다.
 * 연결 가능 여부는 curl과 같은 request()로, 인증서 만료는 시뮬레이션 시각(state.clock)으로 판단한다.
 */
function sClient(state: SystemState, tokens: string[]) {
  // -connect를 빼면 실제 s_client처럼 localhost:4433에 붙으려 한다. -servername은 SNI 이름이다(없으면 접속 이름).
  const target = optValue(tokens, "connect") ?? "localhost:4433";
  const [host, portText = "443"] = target.split(":");
  const name = optValue(tokens, "servername") ?? host;
  const reach = request(state, { host, port: Number(portText) });
  if (!reach.ok && reach.stage !== "tls") {
    const errno = reach.stage === "dns" ? "connect:errno=2" : reach.stage === "refused" ? "connect:errno=111" : "connect:errno=110";
    return fail(`${reach.message ?? "connect failed"}\n${errno}`, 1);
  }
  const chain = servedChain(state, name, Number(portText));
  if (!chain.length) return fail(`CONNECTED(00000003)\nwrite:errno=104\nno peer certificate available`, 1);
  const verdict = verifyChain(state, chain);
  const code = verdict.ok ? "0 (ok)" : `${verdict.code} (${verdict.code === 21 ? "unable to verify the first certificate" : verdict.reason})`;
  // 검증 과정: 루트 쪽부터 서버 인증서 쪽으로 depth를 찍는다. 실패하면 막힌 자리에서 오류 번호를 남긴다.
  const trace: string[] = [];
  if (verdict.ok) {
    const root = verdict.depth[verdict.depth.length - 1].issuer;
    if (chain[0].pem) trace.push(`depth=${verdict.depth.length} ${root}`, "verify return:1");
    [...verdict.depth].reverse().forEach((cert, i) => trace.push(`depth=${verdict.depth.length - 1 - i} ${subjectOf(cert)}`, "verify return:1"));
  } else if (verdict.code === 10) {
    trace.push(`depth=0 ${subjectOf(chain[0])}`, "verify error:num=10:certificate has expired", `notAfter=${opensslDate(chain[0].notAfter)}`, "verify return:1");
  } else {
    const leaf = subjectOf(chain[0]);
    trace.push(`depth=0 ${leaf}`, "verify error:num=20:unable to get local issuer certificate", "verify return:1",
      `depth=0 ${leaf}`, "verify error:num=21:unable to verify the first certificate", "verify return:1");
  }
  const showCerts = hasOpt(tokens, "showcerts");
  return ok([
    "CONNECTED(00000003)", ...trace, "---", "Certificate chain",
    ...chain.flatMap((cert, i) => [` ${i} s:${subjectOf(cert)}`, `   i:${cert.issuer}`,
      `   v:NotBefore: ${opensslDate(cert.notBefore)}; NotAfter: ${opensslDate(cert.notAfter)}`,
      ...(showCerts && cert.pem ? ["-----BEGIN CERTIFICATE-----", cert.pem, "-----END CERTIFICATE-----"] : [])]),
    "---", "Server certificate", `subject=${subjectOf(chain[0])}`, `issuer=${chain[0].issuer}`, "---",
    "New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384", `Verify return code: ${code}`, "---",
  ].join("\n"));
}

export const certbot: Command = {
  name: "certbot",
  summary: "Let's Encrypt 인증서를 갱신한다 (certificates / renew)",
  usage: "certbot <certificates|renew> [--force-renewal] [--dry-run]",
  run({ state, tokens, user }: CommandContext) {
    const unknown = unknownBooleanOption(tokens, "", ["force-renewal", "dry-run"]);
    if (unknown) return fail(`certbot: error: unrecognized arguments: ${unknown}`, 2);
    if (positionals(tokens).length > 1) return fail("certbot: error: unrecognized arguments", 2);
    const sub = positionals(tokens)[0] ?? "certificates";

    if (user !== "root") {
      return fail(
        "You must be running certbot with root privileges (or configured to use a root-owned directory)",
        1,
      );
    }

    if (sub === "certificates") {
      // certbot은 자기가 발급·관리하는 Let's Encrypt 인증서(/etc/letsencrypt)만 안다.
      const managed = state.certificates.filter((cert) => cert.path.startsWith("/etc/letsencrypt/"));
      if (managed.length === 0) return ok("No certificates found.");
      const blocks = managed.map((cert) => {
        const daysLeft = Math.floor((cert.notAfter - state.clock) / 86400_000);
        const validity =
          daysLeft < 0
            ? `EXPIRED (${-daysLeft} days ago)`
            : `VALID: ${daysLeft} days`;
        return [
          `  Certificate Name: ${cert.domain}`,
          `    Domains: ${cert.domain}`,
          `    Expiry Date: ${formatFullTime(cert.notAfter)} (${validity})`,
          `    Certificate Path: ${cert.path}`,
        ].join("\n");
      });
      return ok(["Found the following certs:", ...blocks].join("\n"));
    }

    if (sub === "renew") {
      if (tokens.includes("--dry-run")) return ok("Simulating renewal of existing certificates\nThe dry run was successful. No certificates were saved.");
      const force = hasFlag(tokens, "", "force-renewal");
      // 실제 certbot은 만료 30일 전부터만 갱신한다. 아직 여유가 있으면 건너뛴다.
      const RENEW_WINDOW_MS = 30 * 86400_000;
      const renewed: string[] = [];
      const skipped: string[] = [];

      for (const cert of state.certificates.filter((c) => c.path.startsWith("/etc/letsencrypt/"))) {
        if (!force && cert.notAfter - state.clock > RENEW_WINDOW_MS) {
          skipped.push(cert.domain);
          continue;
        }
        cert.notBefore = state.clock;
        cert.notAfter = state.clock + 90 * 86400_000; // Let's Encrypt 인증서는 90일짜리다
        renewed.push(cert.domain);
        addLog(state, { tag: "certbot", message: `Renewed certificate for ${cert.domain}` });
      }

      const lines = ["Processing renewals..."];
      for (const domain of skipped) {
        lines.push(`  Cert not yet due for renewal: ${domain}`);
      }
      for (const domain of renewed) {
        lines.push(`  Congratulations, all renewals succeeded: ${domain}`);
      }
      lines.push("", "설정을 다시 읽으려면 웹 서버를 reload 해야 합니다.");
      return ok(lines.join("\n"));
    }

    return fail(`certbot: error: unrecognized arguments: ${sub}`, 2);
  },
};
