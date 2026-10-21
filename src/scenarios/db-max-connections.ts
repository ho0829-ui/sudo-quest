import { withCommands } from "../engine/commands";
import type { Check } from "../engine/judge";
import { logLine, putFile } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/** DB를 이 서버에 붙인다. 연결 수가 상한에 딱 붙어 있는 상태. */
const attachSaturatedDatabase: Fault = (state) => {
  state.database = {
    kind: "mysql",
    version: "8.0.36-0ubuntu0.22.04.1",
    variables: {
      max_connections: "100",
      wait_timeout: "28800",
      max_allowed_packet: "67108864",
      innodb_buffer_pool_size: "134217728",
    },
    status: {
      Threads_connected: "100",
      Threads_running: "62",
      // 연결이 거부된 횟수. 이 값이 0이 아니면 상한에 부딪혔다는 결정적 증거다.
      Connection_errors_max_connections: "8412",
      Max_used_connections: "100",
      Uptime: "1209600",
    },
  };
};

/** 커넥션 풀 여유가 생겼는가 — 상한이 앱이 요구하는 만큼 올라가야 한다. */
const maxConnectionsAtLeast = (minimum: number): Check => {
  return (state) => Number(state.database?.variables.max_connections ?? 0) >= minimum;
};

export const dbMaxConnections: Scenario = {
  id: "db-max-connections",
  title: "트래픽 몰리는 시간대에만 500 에러가 나요",
  category: "web-db",
  difficulty: 3,

  ticket: [
    "이상한 증상이 있습니다. 평소에는 멀쩡한데 점심시간과 저녁 프로모션 시간에만 500 에러가 쏟아집니다.",
    "그 시간대가 지나면 저절로 괜찮아집니다. 서버를 재시작하면 잠깐 나아지는 것 같기도 합니다.",
    "지난주에 앱 서버를 3대에서 6대로 늘렸는데, 그 뒤로 심해진 것 같습니다.",
    "재현이 안 되니 원인을 못 찾겠습니다. 도와주세요.",
  ].join("\n"),

  learningObjectives: [
    "특정 시간대에만 나는 장애는 '한계에 부딪히는 자원'을 의심한다",
    "앱 로그의 에러 문구를 DB 쪽 지표와 연결해서 읽는다",
    "서버를 늘리면 DB 연결 수도 함께 늘어난다는 구조를 이해한다",
  ],

  host: "ubuntu-web",
  commands: withCommands("mysql", "curl", "ss", "ps"),

  faults: [
    attachSaturatedDatabase,
    putFile("/var/log/app/shop-api.log", {
      sizeKB: 1_400,
      content:
        [
          "2026-09-11 09:02:11.402 INFO  [http-nio-3000-exec-4] OrderController - POST /api/orders 201 (34ms)",
          "2026-09-11 09:11:58.771 ERROR [http-nio-3000-exec-9] HikariPool - Connection is not available, request timed out after 30000ms",
          "2026-09-11 09:11:58.773 ERROR [http-nio-3000-exec-9] OrderController - POST /api/orders 500",
          "  Caused by: java.sql.SQLException: Too many connections",
          "2026-09-11 09:12:04.118 ERROR [http-nio-3000-exec-2] HikariPool - Connection is not available, request timed out after 30000ms",
          "  Caused by: java.sql.SQLException: Too many connections",
          "2026-09-11 09:12:31.905 INFO  [http-nio-3000-exec-1] HealthController - GET /health 200 (2ms)",
        ].join("\n") + "\n",
      mtimeOffsetMs: -120_000,
    }),
    putFile("/opt/app/config.yml", {
      content: [
        "server:",
        "  host: 0.0.0.0",
        "  port: 3000",
        "",
        "database:",
        "  url: mysql://10.0.3.20:3306/shop",
        "  # 앱 서버 1대당 커넥션 풀 크기. 서버 6대 × 20 = 최대 120개를 요구한다.",
        "  pool: 20",
        "",
        "logging:",
        "  level: info",
        "",
      ].join("\n"),
      owner: "ubuntu",
      group: "ubuntu",
      mtimeOffsetMs: -7 * 86400_000,
    }),
    logLine("monitoring-agent", "shop-api: http_5xx_rate = 18% in last 5 minutes", {
      priority: "err",
      offsetMs: -600_000,
    }),
  ],

  rootCause: {
    answerId: "max-connections",
    choices: [
      {
        id: "max-connections",
        label: "앱 서버를 늘리면서 필요한 DB 연결 수(6대 × 20 = 120)가 DB의 max_connections(100)를 넘어섰고, 트래픽이 몰릴 때 연결을 얻지 못한 요청이 500으로 실패한다",
      },
      {
        id: "slow-query",
        label: "느린 쿼리 때문에 응답이 지연되어 타임아웃이 나고 있다",
        whyWrong:
          "느린 쿼리라면 평소에도 응답이 느려지고 에러 메시지도 타임아웃 계열로 나옵니다. 여기 찍힌 건 'Too many connections' — 쿼리를 실행하기도 전에 연결 자체를 얻지 못한 것입니다.",
      },
      {
        id: "memory",
        label: "앱 서버 메모리가 부족해 요청을 처리하지 못한다",
        whyWrong:
          "메모리 부족이라면 프로세스가 죽거나 OOM 로그가 남습니다. 앱은 죽지 않고 500을 정상적으로 응답하고 있으며, 원인도 로그에 명확히 적혀 있습니다.",
      },
      {
        id: "network",
        label: "앱 서버와 DB 사이 네트워크가 불안정해 연결이 끊긴다",
        whyWrong:
          "네트워크 문제라면 연결 거부나 타임아웃이 나고, 시간대와 무관하게 불규칙하게 발생합니다. 트래픽이 몰리는 시간에만 재현된다는 점이 '자원 한계'를 가리킵니다.",
      },
    ],
  },

  hints: [
    "특정 시간대에만 난다는 건 아주 중요한 단서입니다. 그 시간에 평소보다 많아지는 게 무엇일까요? 그리고 '많아지면 부딪히는 한계'가 어딘가에 있지 않을까요?",
    "앱 로그에서 500이 날 때의 원인 메시지를 끝까지 읽어보세요. 그다음 DB 쪽 설정과 현재 상태를 확인합니다. `mysql -e \"SHOW VARIABLES LIKE 'max_connections'\"` 와 `mysql -e \"SHOW STATUS LIKE 'Threads_connected'\"` 를 비교해 보세요.",
    "max_connections 가 100인데 Threads_connected 도 100입니다. 상한에 딱 붙어 있고, Connection_errors_max_connections 가 8412번이나 쌓였습니다. 앱 설정(pool: 20)과 서버 대수(6대)를 곱하면 120이 필요합니다. `mysql -e \"SET GLOBAL max_connections = 300\"` 으로 상한을 올리세요.",
  ],

  // 앱이 요구하는 120개보다 넉넉해야 한다
  resolution: maxConnectionsAtLeast(200),

  solutionPath: [
    "tail -n 10 /var/log/app/shop-api.log",
    "cat /opt/app/config.yml",
    "mysql -e \"SHOW VARIABLES LIKE 'max_connections'\"",
    "mysql -e \"SHOW STATUS LIKE 'Threads_connected'\"",
    "mysql -e \"SHOW STATUS LIKE 'Connection_errors%'\"",
    "mysql -e \"SET GLOBAL max_connections = 300\"",
    "mysql -e \"SHOW VARIABLES LIKE 'max_connections'\"",
  ],

  postmortem: {
    whatHappened:
      "앱 서버를 3대에서 6대로 늘리면서, 각 서버가 유지하는 커넥션 풀(20개)의 합이 최대 120개가 되었습니다. 그런데 DB의 max_connections 는 100으로 그대로였습니다. 트래픽이 몰려 각 서버가 풀을 가득 채우는 시간대가 되면 연결 요청이 상한을 넘어섰고, 연결을 얻지 못한 요청이 'Too many connections' 로 실패하며 500 에러가 되었습니다. 트래픽이 줄면 연결이 반납되어 저절로 정상으로 보였습니다.",
    whyItHappened:
      "서버를 늘릴 때 애플리케이션 계층만 보고 그 뒤의 공유 자원(DB 연결 수)을 함께 조정하지 않았습니다. 스케일 아웃은 앞단을 늘리지만, 뒷단의 한계는 그대로 남아 오히려 더 빨리 부딪히게 만듭니다.",
    howToFix:
      "당장은 max_connections 를 올려 여유를 확보합니다. 다만 이건 응급 처치입니다 — 연결 하나하나가 DB 메모리를 쓰므로 무한정 올릴 수 없습니다. 근본적으로는 앱의 풀 크기를 적정 수준으로 줄이거나, 커넥션 풀러(ProxySQL, PgBouncer 등)를 앞에 두는 게 맞습니다.",
    howToPrevent: [
      "1) 연결 수를 모니터링합니다. Threads_connected / max_connections 비율이 80%를 넘으면 경고를 보냅니다.",
      "2) Connection_errors_max_connections 를 알림 대상으로 둡니다. 이 값이 0에서 올라가는 순간이 곧 장애의 시작입니다.",
      "3) 스케일 아웃 체크리스트에 '공유 자원 한계 재계산'을 넣습니다 — DB 연결 수, 파일 핸들, 외부 API 쿼터 등.",
      "4) 풀 크기를 서버 대수와 함께 계산합니다. 무작정 크게 잡는 것이 오히려 해롭습니다.",
      "5) 부하 테스트를 실제 예상 서버 대수로 수행합니다.",
    ].join("\n"),
    realWorldNote:
      "'특정 시간대에만 발생하고 저절로 낫는' 장애는 거의 항상 한계에 부딪히는 공유 자원입니다. DB 연결 수, 스레드 풀, 파일 디스크립터, 외부 API 호출 한도가 단골입니다. 재현이 안 된다고 넘기지 말고, 그 시간대의 지표를 보세요. 그리고 스케일 아웃은 공짜가 아닙니다 — 앞단을 늘리면 뒷단의 한계가 더 빨리 옵니다.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "MySQL 8.0 Reference Manual — B.3.2.5 Too many connections", url: "https://dev.mysql.com/doc/refman/8.0/en/too-many-connections.html" },
  ],
};
