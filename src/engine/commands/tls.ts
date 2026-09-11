/** TLS 인증서 명령어: openssl, certbot */
import { hasFlag, positionals } from "../parser/parse";
import { formatFullTime } from "../state/format";
import { addLog } from "../state/log";
import type { Certificate } from "../state/types";
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
  const wantEnd = hasOpt(tokens, "enddate");
  const wantStart = hasOpt(tokens, "startdate");
  const wantSubject = hasOpt(tokens, "subject");
  const wantIssuer = hasOpt(tokens, "issuer");
  const specific = wantEnd || wantStart || wantSubject || wantIssuer;

  if (wantStart || !specific) lines.push(`notBefore=${opensslDate(cert.notBefore)}`);
  if (wantEnd || !specific) lines.push(`notAfter=${opensslDate(cert.notAfter)}`);
  if (wantSubject || !specific) lines.push(`subject=CN = ${cert.domain}`);
  if (wantIssuer || !specific) lines.push(`issuer=${cert.issuer}`);
  return lines.join("\n");
}

export const openssl: Command = {
  name: "openssl",
  summary: "인증서 정보를 본다 (x509 -enddate -noout -in <파일>)",
  usage: "openssl x509 [-enddate] [-subject] [-issuer] [-noout] -in <인증서파일>",
  run({ state, tokens }: CommandContext) {
    if (tokens[0] !== "x509") {
      return fail(`openssl: 이 시뮬레이터는 x509 하위 명령만 지원합니다\n사용법: ${openssl.usage}`, 1);
    }

    const path = optValue(tokens, "in");
    if (!path) return fail("openssl: -in 으로 인증서 파일을 지정하세요", 1);

    const cert = state.certificates.find((c) => c.path === path);
    if (!cert) {
      return fail(`Could not open file or uri for loading certificate: ${path}`, 1);
    }
    return ok(describe(cert, tokens));
  },
};

export const certbot: Command = {
  name: "certbot",
  summary: "Let's Encrypt 인증서를 갱신한다 (certificates / renew)",
  usage: "certbot <certificates|renew> [--force-renewal]",
  run({ state, tokens, user }: CommandContext) {
    const sub = positionals(tokens)[0] ?? "certificates";

    if (user !== "root") {
      return fail(
        "You must be running certbot with root privileges (or configured to use a root-owned directory)",
        1,
      );
    }

    if (sub === "certificates") {
      if (state.certificates.length === 0) return ok("No certificates found.");
      const blocks = state.certificates.map((cert) => {
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
      const force = hasFlag(tokens, "", "force-renewal");
      // 실제 certbot은 만료 30일 전부터만 갱신한다. 아직 여유가 있으면 건너뛴다.
      const RENEW_WINDOW_MS = 30 * 86400_000;
      const renewed: string[] = [];
      const skipped: string[] = [];

      for (const cert of state.certificates) {
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

    return fail(`certbot: 알 수 없는 하위 명령입니다: ${sub}\n사용법: ${certbot.usage}`, 1);
  },
};
