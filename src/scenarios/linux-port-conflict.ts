import { withCommands } from "../engine/commands/names";
import { all, httpResponds, serviceIsActive } from "../engine/judge";
import { crashService, logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/**
 * 누군가 임시 테스트용으로 띄운 파이썬 웹서버가 80 포트를 차지했다.
 * nginx가 뜨지 못하는 판단은 엔진의 포트 충돌 규칙이 한다.
 */
const squatOnPort80: Fault = (state) => {
  state.processes.push({
    pid: 4127,
    user: "ubuntu",
    cpu: 0.1,
    memKB: 18 * 1024,
    command: "/usr/bin/python3 -m http.server 80",
    listenPorts: [{ addr: "0.0.0.0", port: 80 }],
  });
};

export const linuxPortConflict: Scenario = {
  id: "linux-port-conflict",
  title: "nginx를 재시작했더니 아예 안 올라와요",
  category: "linux",
  difficulty: 2,

  ticket: [
    "설정 반영하려고 nginx를 재시작했는데 그 뒤로 아예 올라오질 않습니다.",
    "systemctl restart 를 몇 번 더 해봐도 계속 실패합니다.",
    "설정 파일은 건드리지 않았고, 디스크도 넉넉합니다.",
    "어제 신입 교육하면서 뭔가 테스트를 하긴 했는데 관계가 있을지 모르겠습니다.",
  ].join("\n"),

  learningObjectives: [
    "포트는 한 번에 한 프로세스만 쓸 수 있다는 것을 몸으로 안다",
    "ss -tlnp 로 '누가 그 포트를 잡고 있는지'를 찾아낸다",
    "프로세스를 종료하기 전에 그게 무엇인지 반드시 확인한다",
  ],

  host: "ubuntu-web",
  commands: withCommands("ss", "ps", "kill", "curl", "nginx"),

  faults: [
    squatOnPort80,
    crashService("nginx", "bind() to 0.0.0.0:80 failed (98: Address already in use)", { agoMs: 420_000 }),
    logLine("nginx", "bind() to 0.0.0.0:80 failed (98: Address already in use)", {
      unit: "nginx",
      priority: "err",
      offsetMs: -420_000,
      pid: 4380,
    }),
    logLine("nginx", "still could not bind()", {
      unit: "nginx",
      priority: "err",
      offsetMs: -420_000,
      pid: 4380,
    }),
    logLine("systemd", "nginx.service: Failed with result 'exit-code'.", {
      unit: "nginx",
      priority: "err",
      offsetMs: -420_000,
      pid: 1,
    }),
    logLine("sudo", " ubuntu : TTY=pts/3 ; PWD=/var/www/html ; USER=root ; COMMAND=/usr/bin/python3 -m http.server 80", {
      offsetMs: -7_200_000,
    }),
  ],

  rootCause: {
    answerId: "port-taken",
    choices: [
      {
        id: "port-taken",
        label: "다른 프로세스(python3 -m http.server)가 80 포트를 점유하고 있어 nginx가 바인딩하지 못한다",
      },
      {
        id: "config-error",
        label: "nginx 설정 파일에 문법 오류가 있어 기동에 실패한다",
        whyWrong:
          "`nginx -t` 를 돌려보면 설정은 정상입니다. 로그의 실패 사유도 문법이 아니라 바인딩 실패를 가리킵니다.",
      },
      {
        id: "disk-full",
        label: "디스크가 가득 차 nginx가 로그를 쓰지 못한다",
        whyWrong: "df -h 로 확인하면 디스크는 26% 정도로 넉넉합니다. 에러 메시지도 공간 부족이 아닙니다.",
      },
      {
        id: "permission",
        label: "권한이 부족해 nginx가 80 포트를 열지 못한다",
        whyWrong:
          "1024 미만 포트는 root 권한이 필요한 게 맞지만, nginx는 systemd가 root로 띄웁니다. 게다가 에러는 '권한 없음'이 아니라 '이미 사용 중'입니다.",
      },
    ],
  },

  hints: [
    "실패 사유를 정확히 읽어보세요. 'Address already in use' 는 아주 구체적인 말입니다. 주소가 이미 쓰이고 있다면, 지금 그걸 쓰고 있는 건 누구일까요?",
    "`ss -tlnp` 로 80 포트를 누가 잡고 있는지 볼 수 있습니다. -p 옵션이 프로세스 이름과 PID를 함께 보여줍니다. 그 PID가 무엇인지는 `ps aux` 로 확인하세요.",
    "python3 -m http.server 가 80 포트를 쓰고 있습니다(PID 4127). 어제 테스트하고 끄지 않은 프로세스입니다. `sudo kill 4127` 로 정리한 뒤 nginx를 다시 띄우세요.",
  ],

  resolution: all(serviceIsActive("nginx"), httpResponds("localhost", 80)),

  solutionPath: [
    "systemctl status nginx",
    "journalctl -u nginx -n 10",
    "nginx -t",
    "ss -tlnp",
    "ps aux",
    "sudo kill 4127",
    "sudo systemctl start nginx",
    "curl -I http://localhost",
  ],

  postmortem: {
    whatHappened:
      "교육/테스트 목적으로 띄운 `python3 -m http.server 80` 프로세스가 종료되지 않고 남아 80 포트를 점유하고 있었습니다. nginx가 살아 있는 동안에는 문제가 드러나지 않다가, 재시작하면서 포트를 놓는 순간 파이썬 서버가 그 자리를 차지했고, 이후 nginx는 바인딩에 실패해 올라오지 못했습니다.",
    whyItHappened:
      "임시로 띄운 프로세스를 정리하지 않았고, 그것이 운영 서버의 서비스 포트를 쓰고 있었습니다. 게다가 문제가 즉시 드러나지 않고 '다음 재시작' 때까지 잠복해 있었기 때문에 원인과 증상 사이에 시간차가 생겼습니다.",
    howToFix:
      "`ss -tlnp` 로 포트를 점유한 프로세스를 확인하고, 그것이 무엇인지 `ps` 로 검증한 뒤 종료합니다. 무엇인지 모르는 프로세스를 먼저 죽이지 마세요 — 그게 진짜 서비스일 수도 있습니다.",
    howToPrevent: [
      "1) 운영 서버에서 임시 프로세스를 띄우지 않습니다. 꼭 필요하면 8080 같은 비운영 포트를 쓰고 즉시 정리합니다.",
      "2) 테스트는 운영 서버가 아니라 별도 환경에서 합니다.",
      "3) 예상치 못한 프로세스가 서비스 포트를 점유하면 알림이 오도록 감시합니다.",
      "4) 재시작 후에는 '명령이 성공했는지'가 아니라 '서비스가 실제로 응답하는지'까지 확인합니다.",
    ].join("\n"),
    realWorldNote:
      "이 장애의 진짜 교훈은 '잠복'입니다. 원인이 된 행동(어제의 테스트)과 증상이 나타난 시점(오늘의 재시작)이 떨어져 있어서, 최근 변경만 훑어보면 못 찾습니다. 재시작했을 때만 드러나는 문제가 있다는 걸 기억해 두세요.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "bind(2) — EADDRINUSE: 주소가 이미 사용 중", url: "https://man7.org/linux/man-pages/man2/bind.2.html" },
  ],
};
