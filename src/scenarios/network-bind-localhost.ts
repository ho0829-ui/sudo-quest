import { withCommands } from "../engine/commands";
import { all, portIsListening, serviceIsActive } from "../engine/judge";
import { logLine, putFile, restartedAt } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

export const networkBindLocalhost: Scenario = {
  id: "network-bind-localhost",
  title: "서버 안에서는 되는데 다른 서버에서는 안 돼요",
  category: "network",
  difficulty: 2,

  ticket: [
    "shop-api 서버에서 내부 API 호출이 전부 실패하고 있습니다.",
    "이상한 건, 해당 서버에 직접 들어가서 테스트하면 아주 잘 됩니다.",
    "그런데 다른 서버(배치 서버)에서 호출하면 연결이 거부됩니다.",
    "방화벽은 이미 확인했고 3000 포트는 열려 있습니다. 어제 앱 설정을 정리하긴 했습니다.",
  ].join("\n"),

  learningObjectives: [
    "프로세스가 '어떤 주소'에 바인딩됐는지가 접근 범위를 결정한다는 것을 안다",
    "ss -tlnp 출력에서 127.0.0.1과 0.0.0.0의 차이를 읽는다",
    "설정을 고친 뒤 재시작해야 실제로 반영된다는 것을 확인한다",
  ],

  host: "ubuntu-web",
  commands: withCommands("ss", "curl", "sed", "ufw", "ps"),

  faults: [
    // 설정 파일의 bind 주소를 루프백으로 바꾼다.
    // 서비스가 실제로 어디에 바인딩되는지는 엔진이 이 파일을 읽어서 정한다.
    putFile("/opt/app/config.yml", {
      content: [
        "server:",
        "  host: 127.0.0.1",
        "  port: 3000",
        "",
        "database:",
        "  url: postgres://10.0.3.20:5432/shop",
        "  pool: 20",
        "",
        "logging:",
        "  level: info",
        "",
      ].join("\n"),
      owner: "ubuntu",
      group: "ubuntu",
      mtimeOffsetMs: -72_000_000,
    }),
    logLine("sudo", " ubuntu : TTY=pts/0 ; PWD=/opt/app ; USER=root ; COMMAND=/usr/bin/systemctl restart shop-api", {
      offsetMs: -71_000_000,
    }),
    // 그리고 실제로 재시작됐다. 이때 바뀐 설정이 적용되어 127.0.0.1 에 묶였다.
    restartedAt("shop-api", 71_000_000),
  ],

  rootCause: {
    answerId: "bind-loopback",
    choices: [
      {
        id: "bind-loopback",
        label: "앱이 127.0.0.1(루프백)에만 바인딩되어 있어, 그 서버 밖에서 오는 연결을 아예 받지 못한다",
      },
      {
        id: "firewall",
        label: "방화벽이 3000 포트로 들어오는 연결을 차단하고 있다",
        whyWrong:
          "`ufw status` 를 보면 문제가 있다 해도, 방화벽에 막히면 보통 타임아웃이 납니다. 여기서는 '연결 거부'가 나고 있어 포트에 아무도 없다는 뜻입니다.",
      },
      {
        id: "service-down",
        label: "shop-api 서비스가 죽어 있다",
        whyWrong:
          "서비스는 active 상태이고, 서버 안에서 호출하면 정상 응답이 옵니다. 죽었다면 안에서도 안 됩니다.",
      },
      {
        id: "dns",
        label: "배치 서버가 shop-api 서버의 주소를 잘못 알고 있다",
        whyWrong:
          "이름을 잘못 찾았다면 해석 실패나 엉뚱한 서버 응답이 나옵니다. 정확히 이 서버의 3000 포트에서 거부되고 있는 상황과는 맞지 않습니다.",
      },
    ],
  },

  hints: [
    "\"안에서는 되고 밖에서는 안 된다\"는 방화벽 아니면 바인딩입니다. 방화벽은 이미 확인했다고 하니, 앱이 어느 주소에서 연결을 기다리고 있는지 확인해 보세요.",
    "`ss -tlnp` 를 보세요. Local Address:Port 열에 127.0.0.1 로 적힌 것과 0.0.0.0 으로 적힌 것의 차이가 핵심입니다. 127.0.0.1 은 '이 서버 자신만' 이라는 뜻입니다.",
    "shop-api가 127.0.0.1:3000 에 바인딩돼 있습니다. 바인드 주소는 `/opt/app/config.yml` 의 host 값이 정합니다. 0.0.0.0 으로 고치고 **재시작**해야 실제로 반영됩니다.",
  ],

  // 0.0.0.0 에서 듣고 있어야 외부에서 닿을 수 있다
  resolution: all(serviceIsActive("shop-api"), portIsListening("0.0.0.0", 3000)),

  solutionPath: [
    "systemctl status shop-api",
    "curl -I http://127.0.0.1:3000",
    "ss -tlnp",
    "sudo ufw status",
    "cat /opt/app/config.yml",
    "sudo sed -i 's/host: 127.0.0.1/host: 0.0.0.0/' /opt/app/config.yml",
    "sudo systemctl restart shop-api",
    "ss -tlnp",
  ],

  postmortem: {
    whatHappened:
      "shop-api 애플리케이션이 127.0.0.1(루프백 주소)에만 바인딩되어 있었습니다. 루프백은 그 서버 자신만 쓸 수 있는 주소라서, 서버 안에서 호출하면 정상 동작하지만 다른 서버에서 오는 연결은 아예 받지 못합니다. 방화벽은 관계가 없었고, 애초에 그 주소로는 패킷이 도달할 수 없는 상태였습니다.",
    whyItHappened:
      "설정을 정리하면서 bind 주소가 0.0.0.0 에서 127.0.0.1 로 바뀌었습니다. 로컬 개발 환경의 설정을 그대로 가져오면 흔히 생기는 실수입니다. 재시작 직후 서버 안에서 확인했을 때는 정상으로 보였기 때문에 문제가 드러나지 않았습니다.",
    howToFix:
      "설정의 host 값을 0.0.0.0 으로 되돌리고 서비스를 재시작합니다. 설정 파일만 고치고 재시작하지 않으면 아무것도 바뀌지 않습니다 — 프로세스는 시작할 때 읽은 설정으로 계속 동작하기 때문입니다.",
    howToPrevent: [
      "1) 배포 후 검증을 '그 서버 안'이 아니라 '실제 호출자 위치'에서 합니다. 안에서 하는 curl은 이 장애를 절대 못 잡습니다.",
      "2) 설정 파일을 환경별로 분리하고, 운영 설정은 코드 저장소에서 관리해 리뷰를 거칩니다.",
      "3) 0.0.0.0 으로 여는 대신 내부 IP(10.0.1.10)에만 바인딩하면 더 안전합니다. 필요한 범위만 여는 게 원칙입니다.",
    ].join("\n"),
    realWorldNote:
      "`ss -tlnp` 의 Local Address 열은 읽는 법만 알면 아주 강력합니다. 127.0.0.1 은 자기 자신만, 0.0.0.0 은 모든 인터페이스, 10.0.1.10 같은 구체적 주소는 그 인터페이스만입니다. '안에서는 되는데 밖에서는 안 된다'를 만나면 방화벽보다 먼저 이 열을 보세요.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "nginx core module — listen 지시어(주소·포트 바인딩)", url: "https://nginx.org/en/docs/http/ngx_http_core_module.html" },
    { kind: "survey", title: "Uptime Institute, Annual Outage Analysis 2024 (네트워크·연결성이 IT 서비스 장애 1위)", url: "https://uptimeinstitute.com/resources/research-and-reports/annual-outage-analysis-2024" },
  ],
};
