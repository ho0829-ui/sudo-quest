import { withCommands } from "../engine/commands/names";
import { all, nginxConfigIsValid, serviceIsActive } from "../engine/judge";
import { crashService, logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import { findNode } from "../engine/state/fs";
import type { Scenario } from "../engine/scenario/types";

/**
 * 설정 파일에서 세미콜론 하나를 지운다.
 * 서비스가 뜨지 못하는 판단은 엔진이 한다 (nginx 설정 검증기).
 */
const breakNginxConf: Fault = (state) => {
  const node = findNode(state.fs, "/etc/nginx/nginx.conf");
  if (node?.kind !== "file") throw new Error("nginx.conf 를 찾을 수 없습니다");
  node.content = node.content.replace(
    "server_name shop.example.com;",
    "server_name shop.example.com",
  );
  node.mtime = state.clock - 1_200_000; // 20분 전에 수정됨 (ls -l 에서 단서가 된다)
};

export const webNginxConfig: Scenario = {
  id: "web-nginx-config",
  title: "설정 조금 바꿨을 뿐인데 사이트가 통째로 내려갔어요",
  category: "web-db",
  difficulty: 1,

  ticket: [
    "죄송합니다, 제가 뭔가 잘못 건드린 것 같아요.",
    "오전에 도메인 하나를 추가하려고 nginx 설정 파일을 수정했습니다.",
    "저장하고 재시작했는데 그때부터 사이트가 아예 안 열립니다.",
    "뭘 잘못했는지 모르겠어요. 빨리 복구 부탁드립니다!",
  ].join("\n"),

  learningObjectives: [
    "설정 변경 직후의 장애는 그 변경부터 의심한다",
    "nginx -t 로 재시작 전에 설정을 검증하는 습관을 들인다",
    "에러 메시지에 적힌 파일명과 줄 번호를 그대로 따라간다",
  ],

  host: "ubuntu-web",
  commands: withCommands("nginx", "sed", "curl", "ss"),

  faults: [
    breakNginxConf,
    crashService("nginx", "설정 문법 오류", { agoMs: 1_100_000 }),
    logLine("nginx", 'directive "server_name" is not terminated by ";" in /etc/nginx/nginx.conf:17', {
      unit: "nginx",
      priority: "err",
      offsetMs: -1_100_000,
      pid: 3021,
    }),
    logLine("systemd", "nginx.service: Control process exited, code=exited, status=1/FAILURE", {
      unit: "nginx",
      priority: "err",
      offsetMs: -1_100_000,
      pid: 1,
    }),
    logLine("systemd", "Failed to start nginx.service - A high performance web server and a reverse proxy server.", {
      unit: "nginx",
      priority: "err",
      offsetMs: -1_100_000,
      pid: 1,
    }),
    logLine("sudo", " ubuntu : TTY=pts/0 ; PWD=/etc/nginx ; USER=root ; COMMAND=/usr/bin/systemctl restart nginx", {
      offsetMs: -1_150_000,
    }),
  ],

  rootCause: {
    answerId: "config-syntax",
    choices: [
      {
        id: "config-syntax",
        label: "nginx 설정 파일의 server_name 지시어 끝에 세미콜론이 빠져 문법 오류가 났고, 그 때문에 nginx가 기동하지 못하고 있다",
      },
      {
        id: "port-conflict",
        label: "다른 프로세스가 80 포트를 점유해 nginx가 바인딩에 실패했다",
        whyWrong:
          "포트 충돌이라면 'Address already in use'가 찍힙니다. 게다가 ss -tlnp 를 봐도 80 포트를 쓰는 프로세스가 없습니다.",
      },
      {
        id: "disk-full",
        label: "디스크가 가득 차 nginx가 로그를 쓰지 못하고 있다",
        whyWrong: "df -h 를 보면 디스크는 넉넉합니다. 로그 메시지도 공간 부족이 아니라 문법 오류를 가리킵니다.",
      },
      {
        id: "permission",
        label: "설정 파일 권한이 잘못되어 nginx가 읽지 못하고 있다",
        whyWrong:
          "권한 문제라면 'Permission denied'가 납니다. 실제 에러는 파일을 읽은 뒤 내용에서 발견한 문법 오류입니다.",
      },
    ],
  },

  hints: [
    "\"설정을 바꾸고 재시작했더니 안 된다\"는 신고입니다. 가장 의심스러운 건 무엇일까요? nginx에는 재시작 전에 설정이 올바른지 확인하는 방법이 있습니다.",
    "`sudo systemctl status nginx` 와 `journalctl -u nginx` 로 실패 사유를 보세요. 그리고 `nginx -t` 로 설정 파일 자체를 검사할 수 있습니다.",
    "`nginx -t` 가 /etc/nginx/nginx.conf 의 17번째 줄을 가리킵니다. `cat` 으로 그 줄을 보면 server_name 끝에 세미콜론이 없습니다. `sed -i 's/찾을것/바꿀것/' 파일` 로 고칠 수 있습니다.",
  ],

  resolution: all(nginxConfigIsValid(), serviceIsActive("nginx")),

  solutionPath: [
    "systemctl status nginx",
    "journalctl -u nginx -n 20",
    "nginx -t",
    "cat /etc/nginx/nginx.conf",
    "sudo sed -i 's/server_name shop.example.com/server_name shop.example.com;/' /etc/nginx/nginx.conf",
    "nginx -t",
    "sudo systemctl restart nginx",
    "curl -I http://localhost",
  ],

  postmortem: {
    whatHappened:
      "nginx 설정 파일에서 server_name 지시어 끝의 세미콜론이 빠졌습니다. nginx는 문법 오류가 있는 설정으로는 기동하지 않기 때문에, 재시작하는 순간 서비스가 내려갔고 사이트 전체가 접속 불가 상태가 되었습니다.",
    whyItHappened:
      "설정을 고친 뒤 검증 없이 바로 재시작했습니다. nginx는 `nginx -t` 로 미리 문법을 검사할 수 있는데 이 단계를 건너뛰었고, 그래서 오타 하나가 곧바로 전체 장애로 이어졌습니다.",
    howToFix:
      "빠진 세미콜론을 채우고 `nginx -t` 로 검증한 뒤 재시작합니다. 이미 장애가 난 상황이라면, 원인을 찾는 것보다 직전 설정으로 되돌리는 게 더 빠른 복구일 때도 많습니다.",
    howToPrevent: [
      "1) 재시작 전에 반드시 `nginx -t`. 습관으로 만들거나, 배포 스크립트에 검증 단계를 넣어 실패하면 재시작하지 않게 합니다.",
      "2) `systemctl reload nginx` 를 씁니다. reload는 설정이 잘못되면 기존 프로세스를 유지한 채 거부하므로, 오타가 나도 서비스가 죽지 않습니다.",
      "3) 설정 파일을 git으로 관리합니다. 무엇이 언제 바뀌었는지 보이고 되돌리기도 한 번에 됩니다.",
      "4) 스테이징에서 먼저 적용해 봅니다.",
    ].join("\n"),
    realWorldNote:
      "`restart` 와 `reload` 의 차이는 실무에서 아주 중요합니다. restart는 일단 프로세스를 죽이고 새로 띄우기 때문에 설정이 잘못되면 그대로 장애가 됩니다. reload는 새 설정을 읽어보고 문제가 있으면 기존 프로세스를 그대로 둡니다. 운영 중인 웹 서버에는 reload를 쓰세요.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "nginx 명령줄 스위치 — -t 설정 검사, -s reload", url: "https://nginx.org/en/docs/switches.html" },
    { kind: "official-doc", title: "nginx Beginner's Guide — 설정 반영(reload)과 프로세스 동작", url: "https://nginx.org/en/docs/beginners_guide.html" },
    { kind: "postmortem", title: "danluu/post-mortems — Config Errors 모음(설정 실수로 인한 공개 장애 회고)", url: "https://raw.githubusercontent.com/danluu/post-mortems/master/README.md" },
  ],
};
