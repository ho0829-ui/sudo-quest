import { withCommands } from "../engine/commands";
import { httpResponds } from "../engine/judge";
import { logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/** 인증서를 3일 전에 만료된 상태로 만든다. */
const expireCertificate: Fault = (state) => {
  const cert = state.certificates.find((c) => c.domain === "shop.example.com");
  if (!cert) throw new Error("인증서를 찾을 수 없습니다");
  cert.notBefore = state.clock - 93 * 86400_000;
  cert.notAfter = state.clock - 3 * 86400_000;
};

export const webSslExpired: Scenario = {
  id: "web-ssl-expired",
  title: "고객들이 '안전하지 않은 사이트'라는 경고를 본대요",
  category: "web-db",
  difficulty: 2,

  ticket: [
    "고객 문의가 쏟아지고 있습니다.",
    "사이트에 들어가면 브라우저가 빨간 경고 화면을 띄우면서 '이 연결은 비공개가 아닙니다' 라고 한다고 합니다.",
    "경고를 무시하고 들어가면 사이트는 정상이라고 하네요.",
    "모니터링에서도 HTTPS 체크가 실패한다는 알림이 며칠 전부터 오고 있었습니다. 확인 부탁드립니다.",
  ].join("\n"),

  learningObjectives: [
    "인증서 만료가 서비스 자체의 장애와 어떻게 다른지 이해한다",
    "openssl로 인증서 유효기간을 직접 확인한다",
    "인증서 갱신 후 웹 서버가 새 인증서를 다시 읽어야 한다는 것을 안다",
  ],

  host: "ubuntu-web",
  commands: withCommands("curl", "openssl", "certbot", "ss"),

  faults: [
    expireCertificate,
    logLine("certbot", "Attempting to renew cert (shop.example.com) from /etc/letsencrypt/renewal/shop.example.com.conf produced an unexpected error: connection failed. Skipping.", {
      priority: "err",
      offsetMs: -6 * 86400_000,
    }),
    logLine("certbot", "All renewal attempts failed. The following certs could not be renewed: shop.example.com", {
      priority: "err",
      offsetMs: -6 * 86400_000,
    }),
    logLine("monitoring-agent", "HTTPS check failed for https://shop.example.com: certificate has expired", {
      priority: "warning",
      offsetMs: -3 * 86400_000,
    }),
    logLine("monitoring-agent", "HTTPS check failed for https://shop.example.com: certificate has expired", {
      priority: "warning",
      offsetMs: -600_000,
    }),
  ],

  rootCause: {
    answerId: "cert-expired",
    choices: [
      {
        id: "cert-expired",
        label: "TLS 인증서가 만료되어 브라우저가 연결을 신뢰할 수 없다고 경고하고 있다 (자동 갱신이 며칠 전부터 실패했다)",
      },
      {
        id: "nginx-down",
        label: "nginx가 죽어서 HTTPS 요청을 처리하지 못한다",
        whyWrong:
          "nginx가 죽었다면 경고 화면이 아니라 연결 자체가 안 됩니다. 경고를 무시하면 사이트가 정상적으로 보인다는 건 nginx가 잘 돌고 있다는 뜻입니다.",
      },
      {
        id: "firewall-443",
        label: "방화벽이 443 포트를 막고 있다",
        whyWrong:
          "443이 막혔다면 페이지 자체가 열리지 않습니다. TLS 경고가 뜬다는 건 연결이 이미 이루어졌다는 증거입니다.",
      },
      {
        id: "wrong-domain",
        label: "인증서의 도메인이 사이트 주소와 달라 이름 불일치 오류가 나고 있다",
        whyWrong:
          "그것도 브라우저 경고를 일으키긴 하지만, openssl로 확인해 보면 도메인(CN)은 shop.example.com 으로 정확합니다. 문제는 날짜입니다.",
      },
    ],
  },

  hints: [
    "브라우저가 경고를 띄우면서도 무시하고 들어가면 사이트가 보인다고 합니다. 그렇다면 서버와 애플리케이션은 멀쩡하다는 뜻입니다. HTTPS 연결에서 브라우저가 검사하는 건 무엇일까요?",
    "`curl -v https://shop.example.com` 으로 어느 단계에서 실패하는지 보세요. 그리고 `openssl x509 -enddate -noout -in /etc/letsencrypt/live/shop.example.com/fullchain.pem` 으로 인증서 유효기간을 직접 확인할 수 있습니다.",
    "인증서가 3일 전에 만료됐습니다. 게다가 journalctl을 보면 자동 갱신(certbot)이 6일 전부터 실패하고 있었습니다. `sudo certbot renew` 로 갱신한 뒤 웹 서버를 reload 하세요.",
  ],

  resolution: httpResponds("shop.example.com", 443, true),

  solutionPath: [
    "curl -v https://shop.example.com",
    "journalctl -n 20",
    "openssl x509 -enddate -noout -in /etc/letsencrypt/live/shop.example.com/fullchain.pem",
    "sudo certbot certificates",
    "sudo certbot renew",
    "sudo systemctl restart nginx",
    "curl -I https://shop.example.com",
  ],

  postmortem: {
    whatHappened:
      "shop.example.com 의 TLS 인증서가 3일 전에 만료되었습니다. 서버와 애플리케이션은 정상이었지만, 브라우저는 만료된 인증서를 신뢰하지 않기 때문에 접속하는 모든 사용자에게 보안 경고를 띄웠습니다. 경고를 무시하면 사이트가 보였다는 점이 '서비스는 살아 있고 인증서만 문제'라는 신호였습니다.",
    whyItHappened:
      "certbot 자동 갱신이 6일 전부터 실패하고 있었습니다. 갱신 실패 로그는 남았지만 아무도 보지 않았고, 모니터링의 HTTPS 체크 실패 알림도 실제 대응으로 이어지지 않았습니다. 인증서는 만료 30일 전부터 갱신을 시도하므로, 경고를 놓치지만 않았다면 한 달의 여유가 있었습니다.",
    howToFix:
      "`certbot renew` 로 인증서를 갱신하고 웹 서버를 reload 합니다. nginx는 시작할 때 인증서 파일을 읽어 메모리에 올리기 때문에, 파일만 갱신하고 reload 하지 않으면 여전히 옛 인증서를 제공합니다.",
    howToPrevent: [
      "1) 인증서 만료일을 모니터링합니다. 남은 기간이 30일 미만이면 경고, 7일 미만이면 호출 알림을 보냅니다.",
      "2) 갱신 실패 자체를 알림으로 받습니다. '만료됐다'가 아니라 '갱신이 실패했다' 시점에 알아야 합니다.",
      "3) 갱신 후 자동으로 reload 되도록 certbot의 deploy-hook 을 설정합니다.",
      "4) 가능하면 인증서를 관리형 서비스(ACM 등)에 맡겨 갱신을 자동화합니다.",
    ].join("\n"),
    realWorldNote:
      "인증서 만료는 '가장 예측 가능한 장애'입니다. 날짜가 정해져 있는데도 매년 대형 서비스들이 이걸로 멈춥니다. 이유는 늘 같습니다 — 갱신 자동화는 해뒀는데 그 자동화가 실패했을 때 알아차릴 방법이 없었던 것입니다. 자동화를 믿지 말고, 자동화를 감시하세요.",
  },
};
