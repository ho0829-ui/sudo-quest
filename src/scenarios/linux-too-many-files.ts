import { withCommands } from "../engine/commands";
import type { Scenario } from "../engine/scenario/types";
import { writeFile } from "../engine/state/fs";
import { fdUsage } from "../engine/state/limits";
import { request } from "../engine/state/network";
import { daemonReload } from "../engine/state/systemdUnits";
import type { SystemState } from "../engine/state/types";

const PID = 1340;
const EMFILE = "Error: accept EMFILE";

/** 판정: shop-api가 떠 있고, 새 프로세스의 한도가 필요한 연결보다 커서 막히지 않으며, 헬스 체크가 200이다. */
function recovered(state: SystemState): boolean {
  const service = state.services.find(s => s.name === "shop-api");
  const process = state.processes.find(p => p.pid === service?.mainPid);
  if (!service || service.state !== "active" || !process || fdUsage(state, process).saturated) return false;
  const reply = request(state, { host: "localhost", port: 3000, path: "/health" });
  return reply.ok && reply.status === 200;
}

export const linuxTooManyFiles: Scenario = {
  id: "linux-too-many-files",
  title: "타임 세일이 시작되자 API가 응답을 멈췄어요",
  category: "linux",
  difficulty: 3,
  ticket: [
    "09:00 타임 세일 시작 뒤 상품 페이지의 실시간 재고 알림이 멈추고, API 요청이 응답 없이 끊깁니다.",
    "CPU·메모리·디스크는 여유가 있다고 합니다. 지난주 이 서버(web-01)로 옮겨 왔고, 예전 서버는 같은 트래픽을 버텼어요.",
    "API는 systemd 서비스 shop-api(포트 3000)입니다.",
  ].join("\n"),
  learningObjectives: [
    "EMFILE이 프로세스별 열린 파일 수 한도(RLIMIT_NOFILE)라는 것을 /proc/PID/limits와 /proc/PID/fd로 확인한다",
    "셸의 ulimit -n·limits.conf와 systemd 서비스의 한도가 다르다는 것을 이해한다",
    "drop-in으로 LimitNOFILE을 올리고 daemon-reload·restart 순서로 적용해 검증한다",
  ],
  host: "ubuntu-web",
  commands: withCommands("ps", "free", "curl", "ss", "lsof", "ulimit", "echo", "tee", "mkdir"),
  faults: [(state) => {
    const service = state.services.find(s => s.name === "shop-api")!;
    // 실시간 재고 알림(SSE)은 접속마다 연결 하나를 계속 붙잡는다. 세일 중 약 1,480명이 동시에 접속해 있다.
    service.connections = 1480;
    service.baseFds = 23;
    service.fdExhaustedLog = EMFILE;
    service.http = {
      responses: { "/health": '{"status":"ok"}', "/api/stock/stream": "event: stock\ndata: {\"sku\":\"A-1001\",\"left\":12}" },
      headers: { "X-Powered-By": "Express", "Content-Type": "application/json; charset=utf-8" },
    };
    writeFile(state.fs, service.unitPath, { mtime: state.clock - 8 * 86_400_000, content: [
      "[Unit]", "Description=Shop backend API (Node.js)", "After=network.target", "",
      "[Service]", "WorkingDirectory=/opt/app", "ExecStart=/usr/bin/node /opt/app/server.js", "Restart=on-failure",
      "Environment=NODE_ENV=production", "", "[Install]", "WantedBy=multi-user.target",
    ].join("\n") });
    writeFile(state.fs, "/etc/security/limits.conf", { mtime: state.clock - 8 * 86_400_000, content: [
      "# /etc/security/limits.conf", "#<domain>  <type>  <item>   <value>",
      "# 2026-09-03 서버 이전: 예전 서버(app-legacy)와 같게 열린 파일 수 상향 (ops)",
      "*          soft    nofile   65535", "*          hard    nofile   65535",
      "root       soft    nofile   65535", "root       hard    nofile   65535",
    ].join("\n") });
    writeFile(state.fs, "/home/ubuntu/migration-notes.md", { owner: "ubuntu", mtime: state.clock - 8 * 86_400_000, content: [
      "# app-legacy → web-01 이전 메모 (2026-09-03)", "",
      "- [x] node 20 설치, /opt/app 배포, shop-api.service 등록",
      "- [x] 예전 서버처럼 limits.conf에 nofile 65535 → 로그인해서 ulimit -n 확인: 65535 OK",
      "- [x] 부하 테스트: 동시 접속 300명 정상",
      "- [ ] 세일 대비 동시 접속 1,500명 부하 테스트 (일정 미정)",
    ].join("\n") });
    // 세일 시작 뒤 접속이 1,000을 넘자 accept가 EMFILE로 실패하기 시작했다.
    const start = state.clock - 14 * 60_000;
    for (const [offset, message, priority] of [
      [0, "stock-stream: 412 clients connected", "info"], [180, "stock-stream: 981 clients connected", "info"],
      [240, EMFILE, "err"], [241, "Error: EMFILE: too many open files, open '/opt/app/views/product.html'", "err"],
      [300, EMFILE, "err"], [420, EMFILE, "err"], [600, EMFILE, "err"], [780, EMFILE, "err"],
    ] as const) {
      state.journal.push({ time: start + offset * 1000, tag: "node", unit: "shop-api", pid: PID, priority, message });
    }
    // 지금 systemd가 읽어 둔 설정을 기록한다. 이후 파일만 고치면 daemon-reload 전까지 적용되지 않는다.
    daemonReload(state);
  }],
  rootCause: {
    answerId: "service-nofile",
    choices: [
      { id: "service-nofile", label: "shop-api 서비스의 열린 파일 수 한도가 systemd 기본값 1024라, 동시 연결이 늘자 새 연결을 받지 못했다(EMFILE). limits.conf 설정은 서비스에 적용되지 않았다" },
      { id: "enfile", label: "시스템 전체 열린 파일 수(fs.file-max)가 가득 찼다",
        whyWrong: "`cat /proc/sys/fs/file-nr`의 첫 값은 수천인데 최댓값은 매우 큽니다. 시스템 전체가 찼다면 ENFILE이 나고, 여기 로그는 프로세스 한도인 EMFILE입니다." },
      { id: "oom", label: "메모리가 부족해 API가 느려졌다",
        whyWrong: "`free -h`에 여유가 있고 프로세스는 죽지 않았습니다. 로그의 오류는 EMFILE(열린 파일 수)입니다." },
      { id: "port", label: "다른 프로세스가 3000번 포트를 잡고 있다",
        whyWrong: "`ss -tlnp`에서 3000은 node가 듣고 있습니다. 연결은 들어오지만 프로세스가 accept하지 못해 대기열에서 시간 초과됩니다." },
      { id: "nginx", label: "nginx worker_connections가 부족하다",
        whyWrong: "API 요청은 3000번의 node로 바로 갑니다. `curl -m 5 localhost:3000/health`도 시간 초과되므로 nginx 앞단 문제가 아닙니다." },
    ],
  },
  hints: [
    "CPU·메모리·디스크 말고도 프로세스마다 정해진 한도가 있어요. 앱 로그는 무엇이 모자란다고 말하나요?",
    `\`journalctl -u shop-api -n 5\`, \`cat /proc/${PID}/limits\`, \`sudo ls /proc/${PID}/fd | wc -l\`을 보고, 셸의 \`ulimit -n\`과 왜 다른지 \`systemctl cat shop-api\`로 확인하세요.`,
    "서비스 한도는 1024인데 필요한 연결은 그보다 많아요. limits.conf는 systemd 서비스에 적용되지 않습니다. drop-in에 LimitNOFILE=65535를 넣고 `sudo systemctl daemon-reload` 뒤 `sudo systemctl restart shop-api` 하세요.",
  ],
  resolution: recovered,
  solutionPath: [
    "systemctl status shop-api",
    "journalctl -u shop-api -n 5",
    "ulimit -n",
    `cat /proc/${PID}/limits`,
    `sudo ls /proc/${PID}/fd | wc -l`,
    "cat /proc/sys/fs/file-nr",
    "systemctl cat shop-api",
    "sudo mkdir -p /etc/systemd/system/shop-api.service.d",
    "echo -e '[Service]\\nLimitNOFILE=65535' | sudo tee /etc/systemd/system/shop-api.service.d/override.conf",
    "sudo systemctl daemon-reload",
    "sudo systemctl restart shop-api",
    "systemctl show shop-api -p LimitNOFILE,LimitNOFILESoft",
    "curl -s localhost:3000/health",
  ],
  postmortem: {
    whatHappened: "09:00 타임 세일로 실시간 재고 알림 동시 접속이 약 1,480개로 늘었습니다. shop-api 프로세스의 열린 파일 수 한도는 1024라 연결이 한도에 닿자 accept가 EMFILE로 실패했고, 새 요청은 대기열에서 응답 없이 시간 초과됐습니다.",
    whyItHappened: "이전 작업 때 예전 서버처럼 /etc/security/limits.conf에 nofile 65535를 넣었지만, 이 설정은 로그인 세션(PAM)에만 적용됩니다. systemd 서비스는 unit의 LimitNOFILE(없으면 기본 soft 1024)을 따릅니다. 로그인 셸에서 ulimit -n으로 65535를 확인해 적용됐다고 착각했고, 1,500명 부하 테스트는 하지 않았습니다.",
    howToFix: `drop-in(/etc/systemd/system/shop-api.service.d/override.conf)에 [Service] LimitNOFILE=65535를 넣고 \`sudo systemctl daemon-reload\`, \`sudo systemctl restart shop-api\` 순서로 적용합니다. \`systemctl show shop-api -p LimitNOFILE,LimitNOFILESoft\`와 새 PID의 /proc/PID/limits, \`curl -s localhost:3000/health\`로 확인합니다. daemon-reload를 빼면 systemd는 경고만 하고 옛 한도로 다시 시작합니다.`,
    howToPrevent: [
      "1) 서비스 한도는 unit(LimitNOFILE)에 명시하고, 이전 체크리스트에 /proc/PID/limits 확인을 넣습니다(셸의 ulimit가 아니라).",
      "2) 예상 최대 동시 접속으로 부하 테스트를 하고, 열린 fd 수/한도 비율(예: 80%) 경보를 둡니다.",
      "3) 연결을 오래 붙잡는 기능(SSE·WebSocket)은 접속 수 상한과 재연결 정책을 함께 설계합니다.",
    ].join("\n"),
    realWorldNote: "getrlimit(2): 프로세스가 RLIMIT_NOFILE을 넘어 파일을 열려 하면 EMFILE이 납니다. 시스템 전체 한도(ENFILE, fs.file-max)와는 다릅니다. 실행 중인 프로세스의 한도는 prlimit로 바꿀 수도 있지만 재시작하면 사라지므로 unit 설정이 근본 해결입니다. 이 실습은 연결 수를 시간 변화 없이 즉시 계산하며, prlimit·sysctl·systemctl edit는 지원하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "getrlimit(2) — RLIMIT_NOFILE", url: "https://man7.org/linux/man-pages/man2/getrlimit.2.html" },
    { kind: "official-doc", title: "errno(3) — EMFILE / ENFILE", url: "https://man7.org/linux/man-pages/man3/errno.3.html" },
    { kind: "official-doc", title: "systemd.exec(5) — LimitNOFILE", url: "https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html" },
    { kind: "official-doc", title: "limits.conf(5) — pam_limits 설정", url: "https://man7.org/linux/man-pages/man5/limits.conf.5.html" },
  ],
};
