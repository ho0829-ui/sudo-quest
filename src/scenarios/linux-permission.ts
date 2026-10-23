import { withCommands } from "../engine/commands/names";
import { httpResponds } from "../engine/judge";
import { logLine, putFile } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import { findNode } from "../engine/state/fs";
import type { Scenario } from "../engine/scenario/types";

/**
 * 배포 스크립트가 파일을 root 소유·600 으로 덮어썼다고 가정한다.
 * nginx는 www-data 계정으로 파일을 읽으므로 403이 난다.
 * "403을 돌려준다"는 판단은 엔진이 퍼미션을 보고 직접 한다.
 */
const lockWebRoot: Fault = (state) => {
  const node = findNode(state.fs, "/var/www/html/index.html");
  if (node?.kind !== "file") throw new Error("웹 루트 파일을 찾을 수 없습니다");
  node.owner = "root";
  node.group = "root";
  node.mode = 0o600; // 소유자만 읽고 쓸 수 있다
  node.mtime = state.clock - 2_400_000;
};

export const linuxPermission: Scenario = {
  id: "linux-permission",
  title: "사이트에 들어가면 403 Forbidden이 떠요",
  category: "linux",
  difficulty: 1,

  ticket: [
    "오전 배포 이후로 사이트에 들어가면 '403 Forbidden' 페이지가 뜹니다.",
    "서버가 죽은 건 아닌 것 같은데, 페이지가 아예 안 보입니다.",
    "배포 스크립트는 늘 쓰던 그대로 돌렸습니다.",
    "확인 부탁드립니다.",
  ].join("\n"),

  learningObjectives: [
    "403은 서버가 살아 있다는 뜻임을 안다 (죽었다면 502나 연결 거부가 난다)",
    "웹 서버가 어떤 계정으로 파일을 읽는지 이해한다",
    "ls -l 로 소유자와 권한을 읽고 chown/chmod 로 고친다",
  ],

  host: "ubuntu-web",
  commands: withCommands("curl", "chmod", "chown", "ss"),

  faults: [
    lockWebRoot,
    putFile("/var/log/nginx/error.log", {
      sizeKB: 12,
      content:
        [
          '2026/09/11 08:32:10 [error] 1102#1102: *18 open() "/var/www/html/index.html" failed (13: Permission denied), client: 198.51.100.23, server: shop.example.com, request: "GET / HTTP/1.1", host: "shop.example.com"',
          '2026/09/11 08:41:55 [error] 1102#1102: *24 open() "/var/www/html/index.html" failed (13: Permission denied), client: 198.51.100.77, server: shop.example.com, request: "GET / HTTP/1.1", host: "shop.example.com"',
        ].join("\n") + "\n",
      owner: "www-data",
      mtimeOffsetMs: -600_000,
    }),
    logLine("sudo", " deploy : TTY=pts/1 ; PWD=/var/www/html ; USER=root ; COMMAND=/usr/local/bin/deploy.sh", {
      offsetMs: -2_500_000,
    }),
  ],

  rootCause: {
    answerId: "file-permission",
    choices: [
      {
        id: "file-permission",
        label: "웹 루트 파일의 소유자와 권한이 잘못되어, nginx가 쓰는 www-data 계정이 파일을 읽지 못하고 있다",
      },
      {
        id: "nginx-down",
        label: "nginx가 죽어서 요청을 처리하지 못하고 있다",
        whyWrong:
          "nginx가 죽었다면 403 같은 응답 자체가 오지 않습니다. 403은 '서버가 살아서 요청을 받았고, 다만 거절했다'는 뜻입니다.",
      },
      {
        id: "missing-index",
        label: "index.html 파일이 배포 중에 삭제되었다",
        whyWrong:
          "파일이 없다면 403이 아니라 404가 납니다. ls로 확인해 보면 파일은 그대로 있습니다.",
      },
      {
        id: "firewall",
        label: "방화벽이 HTTP 요청을 막고 있다",
        whyWrong:
          "방화벽에 막혔다면 응답이 아예 오지 않고 타임아웃이 납니다. 403 페이지가 보인다는 건 요청이 nginx까지 도달했다는 증거입니다.",
      },
    ],
  },

  hints: [
    "403은 '못 찾겠다'가 아니라 '찾았지만 안 보여주겠다'는 뜻입니다. 누가 무엇을 거절한 걸까요? nginx는 어떤 계정으로 파일을 읽을까요?",
    "nginx의 에러 로그를 먼저 보세요. `tail /var/log/nginx/error.log` 에 거절 이유가 그대로 적혀 있습니다. 그다음 `ls -l /var/www/html` 로 파일 상태를 확인해 보세요.",
    "로그에 `Permission denied` 가 있고, index.html 이 root 소유에 600 권한입니다. nginx는 www-data 계정으로 도니 읽을 수가 없습니다. `chown` 과 `chmod` 로 고쳐 주세요.",
  ],

  // nginx는 계속 살아 있다. 파일을 읽을 수 있게 되면 200이 돌아온다.
  resolution: httpResponds("localhost", 80),

  solutionPath: [
    "curl -I http://localhost",
    "systemctl status nginx",
    "tail -n 5 /var/log/nginx/error.log",
    "ls -l /var/www/html",
    "sudo chown www-data:www-data /var/www/html/index.html",
    "sudo chmod 644 /var/www/html/index.html",
    "ls -l /var/www/html",
    "curl -I http://localhost",
  ],

  postmortem: {
    whatHappened:
      "배포 과정에서 /var/www/html/index.html 의 소유자가 root로, 권한이 600(소유자만 읽기/쓰기)으로 바뀌었습니다. nginx는 www-data 계정으로 동작하기 때문에 파일을 열 수 없었고, 요청마다 403 Forbidden을 돌려주었습니다. nginx 자체는 정상이었습니다.",
    whyItHappened:
      "배포 스크립트를 root로 실행하면서 파일을 새로 생성했고, 소유자와 권한을 원래대로 되돌리는 단계가 없었습니다. umask 설정에 따라 새로 만들어진 파일이 제한적인 권한을 갖게 되었습니다.",
    howToFix:
      "`chown www-data:www-data` 로 소유자를 돌리고 `chmod 644` 로 읽기 권한을 줍니다. 디렉터리는 755 여야 합니다 — 디렉터리에 실행(x) 권한이 없으면 그 안의 파일에 접근할 수 없습니다.",
    howToPrevent: [
      "1) 배포 스크립트 마지막에 소유자·권한을 명시적으로 맞추는 단계를 넣습니다.",
      "2) 배포 후 자동 검증을 붙입니다. 배포가 끝나면 실제로 `curl -I` 를 날려 200이 아니면 실패로 처리합니다.",
      "3) 배포 계정을 root가 아니라 전용 계정으로 두고, 그 계정이 www-data 그룹에 속하게 합니다.",
    ].join("\n"),
    realWorldNote:
      "HTTP 상태 코드는 범위를 좁히는 좋은 도구입니다. 403은 '서버는 살아 있고 권한 문제', 404는 '경로 문제', 502/504는 '뒤에 있는 애플리케이션 문제', 연결 거부나 타임아웃은 '웹 서버나 네트워크 문제'입니다. 이것만 알아도 조사 시작점이 달라집니다.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "open(2) — EACCES: 경로나 파일에 대한 권한 부족", url: "https://man7.org/linux/man-pages/man2/open.2.html" },
    { kind: "postmortem", title: "danluu/post-mortems — Config Errors 모음(설정 실수로 인한 공개 장애 회고)", url: "https://raw.githubusercontent.com/danluu/post-mortems/master/README.md" },
  ],
};
