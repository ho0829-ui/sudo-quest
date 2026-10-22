import { withCommands } from "../engine/commands/names";
import { httpResponds } from "../engine/judge";
import { logLine, putFile } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

export const networkDns: Scenario = {
  id: "network-dns",
  title: "결제 API 호출이 전부 실패해요",
  category: "network",
  difficulty: 1,

  ticket: [
    "결제 담당입니다. 30분 전부터 결제 API 호출이 전부 실패하고 있습니다.",
    "앱 로그에는 'getaddrinfo EAI_AGAIN' 이라는 메시지가 계속 찍힙니다.",
    "결제사 쪽에 문의했더니 자기들 서비스는 정상이고 다른 고객사는 문제없다고 합니다.",
    "저희 서버만의 문제인 것 같습니다. 확인 부탁드립니다.",
  ].join("\n"),

  learningObjectives: [
    "이름 해석 실패와 연결 실패를 구분한다",
    "ping, dig, curl 의 에러 메시지 차이로 어느 단계가 막혔는지 읽는다",
    "/etc/resolv.conf 가 무엇을 하는 파일인지 이해한다",
  ],

  host: "ubuntu-web",
  commands: withCommands("curl", "ping", "dig", "sed", "ss"),

  faults: [
    // 누군가 resolv.conf의 네임서버를 응답하지 않는 주소로 바꿨다
    putFile("/etc/resolv.conf", {
      content: "nameserver 10.0.0.53\nsearch ap-northeast-2.compute.internal\n",
      mtimeOffsetMs: -1_800_000,
    }),
    putFile("/var/log/app/shop-api.log", {
      sizeKB: 320,
      content:
        [
          "2026-09-11 08:47:02.114 ERROR [payment-worker-2] PaymentClient - request failed: getaddrinfo EAI_AGAIN api.payments.example.com",
          "2026-09-11 08:47:32.220 ERROR [payment-worker-1] PaymentClient - request failed: getaddrinfo EAI_AGAIN api.payments.example.com",
          "2026-09-11 08:48:02.317 INFO  [health-check] HealthController - GET /health 200 (2ms)",
          "2026-09-11 08:48:11.482 ERROR [payment-worker-3] PaymentClient - request failed: getaddrinfo EAI_AGAIN api.payments.example.com",
        ].join("\n") + "\n",
      mtimeOffsetMs: -60_000,
    }),
    logLine("sudo", " ubuntu : TTY=pts/2 ; PWD=/etc ; USER=root ; COMMAND=/usr/bin/vi /etc/resolv.conf", {
      offsetMs: -1_850_000,
    }),
  ],

  rootCause: {
    answerId: "bad-nameserver",
    choices: [
      {
        id: "bad-nameserver",
        label: "/etc/resolv.conf 에 응답하지 않는 네임서버가 설정되어 있어, 도메인 이름을 IP로 바꾸지 못하고 있다",
      },
      {
        id: "api-down",
        label: "결제사 API 서버가 다운되어 응답하지 않는다",
        whyWrong:
          "상대 서버가 죽었다면 IP까지는 찾아낸 뒤 연결 단계에서 실패합니다. 지금은 이름 해석 자체가 안 되고 있어서, 우리 쪽 문제입니다. IP로 직접 요청해 보면 정상 응답이 옵니다.",
      },
      {
        id: "firewall-out",
        label: "방화벽이 외부로 나가는 443 트래픽을 막고 있다",
        whyWrong:
          "방화벽에 막혔다면 연결 타임아웃이 납니다. EAI_AGAIN 은 이름 해석 단계의 에러로, 연결을 시도하기도 전에 실패했다는 뜻입니다.",
      },
      {
        id: "ssl-expired",
        label: "결제 API의 SSL 인증서가 만료되어 연결이 거부되고 있다",
        whyWrong:
          "인증서 문제라면 TLS 핸드셰이크 단계의 에러(certificate has expired)가 납니다. 에러 메시지가 가리키는 단계가 완전히 다릅니다.",
      },
    ],
  },

  hints: [
    "앱 로그의 EAI_AGAIN 이 무슨 뜻인지부터 보세요. 이건 '연결에 실패했다'가 아니라 '주소를 알아내지 못했다'는 뜻입니다. 도메인 이름을 IP로 바꿔주는 건 누구일까요?",
    "`dig api.payments.example.com` 으로 이름 해석을 직접 시도해 보세요. 그리고 IP로 직접 요청하면 되는지 비교해 보면 범위가 확 좁아집니다. 이름 해석 설정은 `/etc/resolv.conf` 에 있습니다.",
    "dig가 `connection timed out; no servers could be reached` 를 냅니다. DNS 서버 자체에 닿지 못한다는 뜻입니다. `cat /etc/resolv.conf` 로 nameserver 주소를 확인하세요. 원래 이 VPC의 리졸버는 10.0.0.2 입니다.",
  ],

  // 이름 해석이 되살아나면 결제 API 호출이 다시 성공한다
  resolution: httpResponds("api.payments.example.com", 443, true),

  solutionPath: [
    "tail -n 5 /var/log/app/shop-api.log",
    "curl -I https://api.payments.example.com",
    "dig api.payments.example.com",
    "cat /etc/resolv.conf",
    "curl -I https://203.0.113.40",
    "sudo sed -i 's/nameserver 10.0.0.53/nameserver 10.0.0.2/' /etc/resolv.conf",
    "dig api.payments.example.com",
    "curl -I https://api.payments.example.com",
  ],

  postmortem: {
    whatHappened:
      "/etc/resolv.conf 의 nameserver가 응답하지 않는 주소(10.0.0.53)로 바뀌어 있었습니다. 이 서버는 도메인 이름을 IP로 바꾸지 못하게 되었고, 결제 API를 비롯한 모든 외부 호출이 이름 해석 단계에서 실패했습니다. 네트워크 자체는 멀쩡해서, IP로 직접 요청하면 정상적으로 응답이 왔습니다.",
    whyItHappened:
      "누군가 서버에 직접 접속해 resolv.conf 를 손으로 수정했습니다. 게다가 /etc/resolv.conf 는 많은 환경에서 systemd-resolved 나 클라우드 에이전트가 자동으로 관리하는 파일이라, 손으로 고치면 재부팅 시 덮어써지거나 예상치 못한 상태가 되기 쉽습니다.",
    howToFix:
      "nameserver 를 원래의 VPC 리졸버(10.0.0.2)로 되돌립니다. 조치 후에는 dig 로 이름 해석이 되는지, 그리고 실제 애플리케이션 호출이 성공하는지까지 확인합니다.",
    howToPrevent: [
      "1) /etc/resolv.conf 를 직접 수정하지 않습니다. 필요한 설정은 systemd-resolved 나 netplan, 또는 DHCP 옵션으로 관리합니다.",
      "2) 이름 해석을 모니터링 항목에 넣습니다. 주요 도메인에 대한 DNS 조회 성공 여부를 주기적으로 확인합니다.",
      "3) 서버 설정 파일을 구성 관리 도구로 관리해, 손으로 바뀐 변경이 자동으로 되돌아오게 합니다.",
    ].join("\n"),
    realWorldNote:
      "'도메인으로는 안 되는데 IP로는 된다'는 DNS 문제의 교과서적인 신호입니다. 반대로 둘 다 안 되면 네트워크나 상대 서버 문제입니다. 이 한 번의 비교로 조사 범위가 절반으로 줄어드니, 외부 호출이 실패하면 가장 먼저 해보세요.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "resolv.conf(5) — 리졸버가 쓰는 nameserver 설정", url: "https://man7.org/linux/man-pages/man5/resolv.conf.5.html" },
    { kind: "postmortem", title: "danluu/post-mortems — Config Errors 모음(설정 실수로 인한 공개 장애 회고)", url: "https://raw.githubusercontent.com/danluu/post-mortems/master/README.md" },
    { kind: "survey", title: "Uptime Institute, Annual Outage Analysis 2024 (네트워크·연결성이 IT 서비스 장애 1위)", url: "https://uptimeinstitute.com/resources/research-and-reports/annual-outage-analysis-2024" },
  ],
};
