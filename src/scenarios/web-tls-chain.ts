import { withCommands } from "../engine/commands/names";
import type { Scenario } from "../engine/scenario/types";
import { verifyChain } from "../engine/state/certs";
import { findNode, writeFile } from "../engine/state/fs";
import { request, servedChain } from "../engine/state/network";
import { findService } from "../engine/state/services";
import type { Certificate, SystemState } from "../engine/state/types";

const DAY = 86_400_000;
const SSL = "/etc/nginx/ssl";
const CA = "C = US, O = Example Trust, CN = Example Trust RSA CA 2026";
const ROOT = "C = US, O = Example Trust, CN = Example Trust Root R1";

/** 가짜 PEM 본문(base64 모양). 파일 내용에 이 줄이 있으면 그 인증서가 들어 있는 것이다. */
const pemBody = (seed: string) => `MIIG${seed}`.padEnd(64, "A").slice(0, 64) + "\n" + `${seed}QIDAQABo4ICCzCCAgcwDgYDVR0PAQH`.padEnd(64, "x").slice(0, 64);
const pemFile = (body: string) => `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----\n`;

/** 판정: nginx가 보내는 체인이 루트까지 이어지고(curl·openssl 검증 0), https 요청이 성공한다. */
function chainComplete(state: SystemState): boolean {
  const chain = servedChain(state, "shop.example.com", 443);
  const reply = request(state, { host: "shop.example.com", port: 443, tls: true });
  return findService(state, "nginx")?.state === "active" && chain.length > 0 && verifyChain(state, chain).ok && reply.ok;
}

export const webTlsChain: Scenario = {
  id: "web-tls-chain",
  title: "일부 고객만 '안전하지 않은 연결'이래요",
  category: "web-db",
  difficulty: 3,
  ticket: [
    "어제 인증서를 유료 인증서로 교체한 뒤, PC 크롬에서는 사이트가 정상인데 안드로이드 앱과 결제사 웹훅이 인증서 오류로 실패합니다.",
    "결제사에서 받은 알림은 /home/ubuntu/pg-webhook-alert.txt에 있습니다. 인증서 파일은 /etc/nginx/ssl에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "\"어디서는 되고 어디서는 안 되는\" 인증서 오류에서 체인(중간 인증서) 문제를 의심한다",
    "openssl s_client의 Certificate chain과 Verify return code, x509의 subject·issuer로 체인을 확인한다",
    "서버 인증서 뒤에 중간 인증서를 이어 붙인 파일로 ssl_certificate를 바꾸고 nginx -t·reload로 검증한다",
  ],
  host: "ubuntu-web",
  commands: withCommands("curl", "openssl", "nginx", "sed", "tee", "certbot", "ss"),
  faults: [(state) => {
    const issued = state.clock - DAY;
    const leaf: Certificate = { path: `${SSL}/shop.example.com.crt`, domain: "shop.example.com", subject: "CN = shop.example.com", issuer: CA,
      notBefore: issued, notAfter: issued + 365 * DAY, pem: pemBody("shopLeaf2026"), keyId: "MIIEvQIBADANBgkqhkiG9w0BAQEFAASCshop2026" };
    const intermediate: Certificate = { path: `${SSL}/ExampleTrustCA.crt`, domain: "Example Trust RSA CA 2026", subject: CA, issuer: ROOT,
      notBefore: issued - 400 * DAY, notAfter: issued + 3000 * DAY, pem: pemBody("exampleTrustCA2026") };
    state.certificates.push(leaf, intermediate);
    writeFile(state.fs, leaf.path, { mtime: issued, content: pemFile(leaf.pem!) });
    writeFile(state.fs, intermediate.path, { mtime: issued, content: pemFile(intermediate.pem!) });
    writeFile(state.fs, `${SSL}/shop.example.com.key`, { mode: 0o600, mtime: issued,
      content: `-----BEGIN PRIVATE KEY-----\n${leaf.keyId}\n-----END PRIVATE KEY-----\n` });
    writeFile(state.fs, `${SSL}/README.txt`, { mtime: issued, content: [
      "Example Trust 인증서 발급 안내 (주문 #ET-20260910-4471)", "",
      "포함 파일", "- shop.example.com.crt : 서버 인증서", "- ExampleTrustCA.crt   : 중간 인증서(Intermediate CA)", "",
      "웹 서버별 설치 방법은 https://example-trust.test/install 를 참고하세요.",
    ].join("\n") });
    // 장애: 어제 교체하면서 서버 인증서 한 장만 ssl_certificate로 지정하고 reload했다(중간 인증서 누락).
    const conf = findNode(state.fs, "/etc/nginx/nginx.conf");
    if (conf?.kind === "file") {
      const tls = [
        "    server {", "        listen 443 ssl;", "        server_name shop.example.com;", "        root /var/www/html;",
        `        ssl_certificate ${SSL}/shop.example.com.crt;`, `        ssl_certificate_key ${SSL}/shop.example.com.key;`, "",
        "        location / {", "            try_files $uri $uri/ =404;", "        }", "",
        "        location /api/ {", "            proxy_pass http://127.0.0.1:3000/;", "        }", "    }",
      ].join("\n");
      const content = conf.content.replace(/\}\s*$/, `\n${tls}\n}\n`);
      writeFile(state.fs, "/etc/nginx/nginx.conf", { content, mtime: issued, owner: conf.owner, mode: conf.mode });
      findService(state, "nginx")!.configSnapshot = content;
    }
    writeFile(state.fs, "/home/ubuntu/pg-webhook-alert.txt", { owner: "ubuntu", mtime: state.clock - 40 * 60_000, content: [
      "[ExamplePay] 웹훅 전송 실패 알림", "",
      "가맹점: shop.example.com", "대상 URL: https://shop.example.com/api/payments/webhook",
      "오류: SSL certificate problem: unable to get local issuer certificate", "실패 건수: 37건 (재시도 대기 중)",
    ].join("\n") });
    const log = findNode(state.fs, "/var/log/nginx/error.log");
    const before = log?.kind === "file" ? log.content.replace(/\n$/, "") : "";
    writeFile(state.fs, "/var/log/nginx/error.log", { sizeKB: 8, mtime: state.clock - 5 * 60_000, content: [before,
      "2026/09/11 08:41:07 [info] 1102#1102: *5310 SSL_do_handshake() failed (SSL: error:0A000416:SSL routines::sslv3 alert certificate unknown:SSL alert number 46) while SSL handshaking, client: 10.0.0.12, server: 0.0.0.0:443",
      "2026/09/11 09:10:52 [info] 1102#1102: *5402 SSL_do_handshake() failed (SSL: error:0A000416:SSL routines::sslv3 alert certificate unknown:SSL alert number 46) while SSL handshaking, client: 10.0.0.13, server: 0.0.0.0:443",
    ].filter(Boolean).join("\n") });
  }],
  rootCause: {
    answerId: "missing-intermediate",
    choices: [
      { id: "missing-intermediate", label: "nginx가 서버 인증서 한 장만 보내고 중간 인증서를 빠뜨려, 루트만 믿는 클라이언트가 체인을 잇지 못한다" },
      { id: "expired", label: "새 인증서가 만료됐다",
        whyWrong: "`openssl x509 -in /etc/nginx/ssl/shop.example.com.crt -noout -dates`의 notAfter는 1년 뒤입니다. 만료라면 Verify return code가 10(certificate has expired)입니다." },
      { id: "name-mismatch", label: "인증서 이름(CN)이 도메인과 다르다",
        whyWrong: "s_client의 subject는 CN = shop.example.com으로 도메인과 같습니다. 이름이 다르면 curl은 \"no alternative certificate subject name matches\"를 냅니다." },
      { id: "old-android", label: "안드로이드 기기가 오래돼 새 인증서를 모른다",
        whyWrong: "서버 자신에서 `curl -I https://shop.example.com`을 해도 같은 오류가 나고, 결제사 서버도 실패합니다. 기기 문제가 아니라 서버가 보내는 체인이 부족합니다." },
      { id: "firewall", label: "방화벽이 443을 막는다",
        whyWrong: "s_client가 CONNECTED 후 인증서까지 받아 옵니다. 연결은 되고, 받은 인증서를 검증하지 못하는 것입니다." },
    ],
  },
  hints: [
    "PC 브라우저는 되고 다른 곳은 안 된다면, 둘이 인증서를 '검증하는 방식'의 차이를 떠올려 보세요. 서버가 무엇을 보내고 있나요?",
    "`openssl s_client -connect shop.example.com:443 -servername shop.example.com`의 Certificate chain 줄 수와 Verify return code, `grep -n ssl_certificate /etc/nginx/nginx.conf`를 보세요.",
    "체인에 서버 인증서 한 장뿐이에요. `cat /etc/nginx/ssl/shop.example.com.crt /etc/nginx/ssl/ExampleTrustCA.crt | sudo tee /etc/nginx/ssl/shop.example.com.fullchain.crt`로 합치고 ssl_certificate를 그 파일로 바꾼 뒤 `sudo nginx -t`, `sudo systemctl reload nginx` 하세요.",
  ],
  resolution: chainComplete,
  solutionPath: [
    "cat /home/ubuntu/pg-webhook-alert.txt",
    "openssl s_client -connect shop.example.com:443 -servername shop.example.com",
    "grep -n ssl_certificate /etc/nginx/nginx.conf",
    "ls -l /etc/nginx/ssl",
    "openssl x509 -in /etc/nginx/ssl/shop.example.com.crt -noout -subject -issuer",
    "openssl x509 -in /etc/nginx/ssl/ExampleTrustCA.crt -noout -subject -issuer",
    "cat /etc/nginx/ssl/shop.example.com.crt /etc/nginx/ssl/ExampleTrustCA.crt | sudo tee /etc/nginx/ssl/shop.example.com.fullchain.crt",
    "sudo sed -i 's#ssl/shop.example.com.crt#ssl/shop.example.com.fullchain.crt#' /etc/nginx/nginx.conf",
    "sudo nginx -t",
    "sudo systemctl reload nginx",
    "curl -I https://shop.example.com",
  ],
  postmortem: {
    whatHappened: "어제 유료 인증서로 교체하면서 nginx ssl_certificate에 서버 인증서 한 장만 지정했습니다. 서버가 중간 인증서(Example Trust RSA CA 2026)를 보내지 않아, 루트 인증서만 가진 클라이언트(안드로이드 앱, 결제사 서버, curl)는 서버 인증서에서 루트까지 체인을 잇지 못해 검증에 실패했습니다.",
    whyItHappened: "Let's Encrypt(certbot)는 fullchain.pem을 만들어 주지만, 이번 CA는 서버 인증서와 중간 인증서를 따로 보냈습니다. PC 크롬은 인증서에 적힌 주소(AIA)에서 중간 인증서를 스스로 받아 와 정상으로 보였기 때문에, 교체 뒤 브라우저 확인만으로는 문제를 알 수 없었습니다.",
    howToFix: "`cat /etc/nginx/ssl/shop.example.com.crt /etc/nginx/ssl/ExampleTrustCA.crt | sudo tee /etc/nginx/ssl/shop.example.com.fullchain.crt`로 서버 인증서 → 중간 인증서 순서로 합치고, ssl_certificate를 그 파일로 바꾼 뒤 `sudo nginx -t`, `sudo systemctl reload nginx` 합니다. `openssl s_client`의 Verify return code가 0이고 `curl -I https://shop.example.com`이 성공하는지 확인합니다. 순서를 거꾸로 합치면 첫 인증서가 키와 짝이 맞지 않아 nginx -t가 key values mismatch로 실패합니다.",
    howToPrevent: [
      "1) 인증서 교체 체크리스트에 \"openssl s_client의 체인 수와 Verify return code 0 확인\"을 넣습니다(브라우저 확인만으로 끝내지 않음).",
      "2) 외부에서 체인을 검사하는 모니터링(curl·SSL 검사 도구)을 두고, 만료뿐 아니라 검증 실패도 경보합니다.",
      "3) 가능하면 체인을 자동으로 만들어 주는 ACME(Let's Encrypt 등) 발급·갱신으로 통일합니다.",
    ].join("\n"),
    realWorldNote: "nginx 문서: 서버 인증서와 중간 인증서를 한 파일에 이어 붙이되 서버 인증서가 먼저 와야 합니다. 브라우저마다 빠진 중간 인증서를 보완하는 방식이 달라 \"어떤 곳만 실패\"가 대표적인 증상입니다. 이 실습은 실제 TLS 핸드셰이크·OCSP·브라우저의 중간 인증서 받기를 재현하지 않고, 서버가 보내는 체인과 루트 목록으로 검증 결과를 계산합니다.",
  },
  evidence: [
    { kind: "official-doc", title: "nginx — Configuring HTTPS servers: SSL certificate chains", url: "https://nginx.org/en/docs/http/configuring_https_servers.html#chains" },
    { kind: "official-doc", title: "nginx — ngx_http_ssl_module: ssl_certificate", url: "https://nginx.org/en/docs/http/ngx_http_ssl_module.html#ssl_certificate" },
    { kind: "official-doc", title: "OpenSSL — openssl-s_client", url: "https://docs.openssl.org/3.0/man1/openssl-s_client/" },
    { kind: "official-doc", title: "curl — SSL certificate verification", url: "https://curl.se/docs/sslcerts.html" },
  ],
};
