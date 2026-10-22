import { withCommands } from "../engine/commands/names";
import type { Scenario } from "../engine/scenario/types";
import { findNode, writeFile } from "../engine/state/fs";
import { request } from "../engine/state/network";
import { findService, startService, stopService } from "../engine/state/services";
import type { SystemState } from "../engine/state/types";

/** nginx error.log의 upstream 연결 실패 한 줄(실제 형식). */
const upstreamError = (time: string, conn: number, client: string, request: string, upstream: string) =>
  `2026/09/11 ${time} [error] 1102#1102: *${conn} connect() failed (111: Connection refused) while connecting to upstream, ` +
  `client: ${client}, server: shop.example.com, request: "${request}", upstream: "${upstream}", host: "shop.example.com"`;

/** 판정: nginx를 거친 /api/health 요청이 앱까지 가서 200을 받는다. */
function apiThroughNginx(state: SystemState): boolean {
  const reply = request(state, { host: "localhost", port: 80, path: "/api/health" });
  return findService(state, "nginx")?.state === "active" && reply.ok && reply.status === 200 && (reply.body ?? "").includes('"status":"ok"');
}

export const webUpstream502: Scenario = {
  id: "web-upstream-502",
  title: "배포 뒤 상품 목록이 Bad Gateway래요",
  category: "web-db",
  difficulty: 2,
  ticket: [
    "11시 shop-api 2.4.0 배포 뒤부터 쇼핑몰 첫 화면은 열리는데, 상품 목록·장바구니만 \"502 Bad Gateway\"로 실패합니다.",
    "개발팀은 앱 서버가 정상으로 떠 있고 배포 스모크 테스트도 통과했다고 합니다.",
    "web-01은 nginx가 앞에서 /api/ 요청을 앱(shop-api)으로 넘기는 구조입니다.",
  ].join("\n"),
  learningObjectives: [
    "502는 nginx가 응답한 것이고, 문제는 nginx 뒤(upstream) 연결이라는 것을 오류 로그로 확인한다",
    "nginx가 넘기는 주소(proxy_pass)와 앱이 실제로 듣는 포트(ss)를 비교한다",
    "설정을 고친 뒤 nginx -t와 reload로 적용하고, nginx를 거친 요청으로 검증한다",
  ],
  host: "ubuntu-web",
  commands: withCommands("curl", "ss", "ps", "nginx", "sed"),
  faults: [(state) => {
    const deployed = state.clock - 13 * 60_000;
    const api = findService(state, "shop-api")!;
    api.http = {
      responses: {
        "/health": '{"status":"ok","version":"2.4.0"}',
        "/products": '[{"id":101,"name":"무선 키보드","price":39000},{"id":102,"name":"USB-C 허브","price":27000}]',
        "/cart": '{"items":[]}',
      },
      headers: { "X-Powered-By": "Express", "Content-Type": "application/json; charset=utf-8" },
    };
    // 장애: 2.4.0이 기본 포트를 8080으로 바꿨고, 배포가 새 기본 설정 파일을 깔았다. nginx는 여전히 3000으로 넘긴다.
    const config = findNode(state.fs, "/opt/app/config.yml");
    if (config?.kind === "file") {
      writeFile(state.fs, "/opt/app/config.yml", { content: config.content.replace("port: 3000", "port: 8080"), mtime: deployed, owner: config.owner, mode: config.mode });
    }
    writeFile(state.fs, "/opt/app/CHANGELOG.md", { mtime: deployed, content: [
      "# shop-api CHANGELOG", "",
      "## 2.4.0 (2026-09-11)",
      "- 상품 목록 응답에 재고 수량 추가",
      "- 기본 포트를 3000 → 8080으로 변경 (컨테이너 표준에 맞춤). config.yml의 server.port로 바꿀 수 있음",
      "- 배포 패키지의 config.yml을 새 기본값으로 교체", "",
      "## 2.3.2", "- 장바구니 금액 반올림 오류 수정",
    ].join("\n") });
    stopService(state, "shop-api");
    state.clock = deployed;
    startService(state, "shop-api");
    state.journal.push({ time: deployed, tag: "node", unit: "shop-api", pid: api.mainPid, priority: "info", message: "shop-api 2.4.0 listening on 0.0.0.0:8080" });
    state.clock = deployed + 13 * 60_000;
    const errors = [
      upstreamError("09:03:11", 4812, "10.0.0.12", "GET /api/products?page=1 HTTP/1.1", "http://127.0.0.1:3000/products?page=1"),
      upstreamError("09:12:12", 4907, "10.0.0.13", "GET /api/cart HTTP/1.1", "http://127.0.0.1:3000/cart"),
      upstreamError("09:14:40", 4955, "10.0.0.12", "GET /api/products?page=2 HTTP/1.1", "http://127.0.0.1:3000/products?page=2"),
    ];
    writeFile(state.fs, "/var/log/nginx/error.log", { sizeKB: 4, mtime: state.clock - 60_000, content: errors.join("\n") });
    const access = findNode(state.fs, "/var/log/nginx/access.log");
    const before = access?.kind === "file" ? access.content.replace(/\n$/, "") : "";
    writeFile(state.fs, "/var/log/nginx/access.log", { sizeKB: 64, mtime: state.clock - 60_000, content: [before,
      '10.0.0.12 - - [11/Sep/2026:09:03:10 +0000] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0"',
      '10.0.0.12 - - [11/Sep/2026:09:03:11 +0000] "GET /api/products?page=1 HTTP/1.1" 502 166 "-" "Mozilla/5.0"',
      '10.0.0.13 - - [11/Sep/2026:09:12:12 +0000] "GET /api/cart HTTP/1.1" 502 166 "-" "Mozilla/5.0"',
    ].filter(Boolean).join("\n") });
  }],
  rootCause: {
    answerId: "upstream-port",
    choices: [
      { id: "upstream-port", label: "앱이 새 기본 포트 8080으로 떴는데 nginx proxy_pass는 여전히 127.0.0.1:3000으로 넘겨 연결이 거부된다" },
      { id: "app-down", label: "shop-api 프로세스가 죽어 있다",
        whyWrong: "`ss -tlnp`에 node가 8080에서 듣고 있고 `curl -s localhost:8080/health`는 200입니다. 앱은 살아 있고, nginx가 다른 포트로 찾아가고 있습니다." },
      { id: "nginx-syntax", label: "nginx 설정 문법이 깨졌다",
        whyWrong: "`sudo nginx -t`는 통과하고 첫 화면(정적 파일)은 잘 열립니다. 문법이 틀렸다면 nginx가 뜨지도 못했을 것입니다." },
      { id: "firewall", label: "방화벽(ufw)이 3000번 포트를 막는다",
        whyWrong: "nginx와 앱은 같은 서버라 127.0.0.1 연결은 방화벽을 거치지 않습니다. 오류 로그의 111: Connection refused는 그 포트에서 듣는 프로세스가 없다는 뜻입니다." },
      { id: "db", label: "DB가 느려 앱이 응답을 못 한다",
        whyWrong: "그 경우 nginx는 upstream timed out(504)을 남깁니다. 여기서는 연결 자체가 거부(111)되어 502입니다." },
    ],
  },
  hints: [
    "502를 돌려준 건 누구일까요? 그 서버가 '뒤쪽과 연결하다 실패했다'는 기록을 남겼을 거예요.",
    "`tail -n 3 /var/log/nginx/error.log`의 upstream 주소와 `ss -tlnp`에서 앱이 실제로 듣는 포트, `grep -n proxy_pass /etc/nginx/nginx.conf`를 비교해 보세요.",
    "nginx는 127.0.0.1:3000으로 넘기는데 앱은 8080에서 들어요. `sudo sed -i 's/127.0.0.1:3000/127.0.0.1:8080/' /etc/nginx/nginx.conf` 뒤 `sudo nginx -t`, `sudo systemctl reload nginx` 하세요.",
  ],
  resolution: apiThroughNginx,
  solutionPath: [
    "curl -i http://localhost/api/health",
    "tail -n 3 /var/log/nginx/error.log",
    "ss -tlnp",
    "curl -s localhost:8080/health",
    "cat /opt/app/CHANGELOG.md",
    "grep -n proxy_pass /etc/nginx/nginx.conf",
    "sudo sed -i 's/127.0.0.1:3000/127.0.0.1:8080/' /etc/nginx/nginx.conf",
    "sudo nginx -t",
    "sudo systemctl reload nginx",
    "curl -i http://localhost/api/health",
  ],
  postmortem: {
    whatHappened: "11시 shop-api 2.4.0 배포로 앱의 기본 포트가 3000에서 8080으로 바뀌었습니다. nginx의 proxy_pass는 그대로 127.0.0.1:3000이라 /api/ 요청마다 연결이 거부(111)되었고, nginx가 502 Bad Gateway를 돌려줬습니다. 정적 파일인 첫 화면은 nginx가 직접 주므로 정상이었습니다.",
    whyItHappened: "앱 변경(포트)이 앞단 설정(nginx)과 다른 저장소·다른 담당이라 함께 바뀌지 않았고, 배포가 config.yml을 새 기본값으로 덮어썼습니다. 스모크 테스트는 앱 포트로 직접 요청해 nginx를 거치는 경로를 확인하지 않았습니다.",
    howToFix: "`sudo sed -i 's/127.0.0.1:3000/127.0.0.1:8080/' /etc/nginx/nginx.conf`로 upstream을 고치고 `sudo nginx -t`, `sudo systemctl reload nginx`로 적용한 뒤 `curl -i http://localhost/api/health`로 nginx를 거친 응답을 확인합니다. 또는 config.yml의 port를 3000으로 되돌리고 `sudo systemctl restart shop-api` 해도 됩니다. 파일만 고치고 reload하지 않으면 nginx는 옛 설정으로 계속 동작합니다.",
    howToPrevent: [
      "1) 앱 포트를 배포 설정(환경 변수·config)에 명시하고, nginx upstream과 같은 변경에서 함께 관리합니다.",
      "2) 스모크 테스트는 사용자와 같은 경로(nginx → 앱)로 /api/health를 확인합니다.",
      "3) nginx 5xx 비율과 upstream 연결 실패(error.log)를 경보로 겁니다. 502(연결 실패)와 504(응답 지연)를 구분해 봅니다.",
    ].join("\n"),
    realWorldNote: "nginx proxy_pass에 URI(끝의 / 포함)가 있으면 location 접두사(/api/)가 그 URI로 바뀌어 넘어갑니다. 그래서 로그의 upstream 주소는 /products입니다. 이 실습은 nginx 설정 중 server·location·upstream·proxy_pass·root만 해석하며, 고객 요청으로 쌓이는 로그는 장애 시점에 미리 넣어 두었습니다(플레이어의 curl은 로그를 늘리지 않습니다).",
  },
  evidence: [
    { kind: "official-doc", title: "nginx — ngx_http_proxy_module: proxy_pass", url: "https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_pass" },
    { kind: "official-doc", title: "nginx — ngx_http_upstream_module", url: "https://nginx.org/en/docs/http/ngx_http_upstream_module.html" },
    { kind: "official-doc", title: "MDN — 502 Bad Gateway", url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/502" },
  ],
};
