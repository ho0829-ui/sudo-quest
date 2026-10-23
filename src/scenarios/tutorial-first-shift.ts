import { serviceIsActive } from "../engine/judge";
import { logLine, putFile, stoppedAt } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/** 아침 정기 점검 스크립트가 nginx를 내린 뒤 다시 올리지 않고 끝난 지 55분. (시나리오 시각 09:15, 로그는 08:00부터) */
const STOPPED_AGO_MS = 3_300_000;

/**
 * 튜토리얼 전용 연습 실습. 실습 목록(scenarios)에는 넣지 않아 점수·학습 기록·파티·크레딧 실습 수에 들어가지 않는다.
 * 일부러 아주 쉽게 만든다: 상태 확인 → 로그 → 원인 → 조치 → 리포트의 흐름을 5분 안에 한 바퀴 돌아 보는 게 목적이다.
 * 그래도 자동 검증(스키마·주입 직후 미복구·모범 풀이·정답 밖 탐색)은 다른 실습과 똑같이 받는다.
 */
export const tutorialScenario: Scenario = {
  id: "tutorial-first-shift",
  title: "첫 근무: 사이트가 열리지 않아요",
  category: "linux",
  difficulty: 1,

  ticket: [
    "운영팀입니다. 오늘 첫 근무시죠? 환영합니다!",
    "출근하자마자 죄송하지만, 아침부터 쇼핑몰 사이트(web-01)가 열리지 않는다는 연락이 왔어요.",
    "브라우저에는 '사이트에 연결할 수 없음'이 뜹니다.",
    "어디서부터 봐야 할지 같이 확인해 주세요.",
  ].join("\n"),

  learningObjectives: [
    "티켓의 증상에서 출발해 서버 안의 서비스 상태부터 확인한다",
    "systemctl status로 서비스가 '죽은 것(failed)'인지 '꺼진 것(inactive)'인지 구분한다",
    "journalctl로 언제, 무엇이 서비스를 내렸는지 기록을 찾는다",
  ],

  host: "ubuntu-web",

  faults: [
    // 0) 원인과 무관한 정상 기록. 로그는 쌓인 순서대로 보이므로 시각 순서대로 넣는다.
    logLine("CRON", "(root) CMD (/usr/local/bin/backup.sh)", { offsetMs: -STOPPED_AGO_MS - 180_000, pid: 4410 }),
    // 1) 아침 점검: 로그 정리를 위해 nginx를 내렸다(systemd가 "Stopped nginx.service"를 남긴다)
    logLine("maint.sh", "maintenance started (log cleanup)", { offsetMs: -STOPPED_AGO_MS - 60_000, pid: 3101 }),
    logLine("maint.sh", "stopping nginx before cleanup", { offsetMs: -STOPPED_AGO_MS - 1_000, pid: 3101 }),
    stoppedAt("nginx", STOPPED_AGO_MS),
    // 2) 정리는 끝났지만 다시 켜는 단계를 건너뛰었다(플레이어가 찾아야 할 단서)
    logLine("maint.sh", "removed 14 rotated logs under /var/log/nginx", { offsetMs: -STOPPED_AGO_MS + 40_000, pid: 3101 }),
    logLine("maint.sh", "restart step skipped (--no-restart)", { offsetMs: -STOPPED_AGO_MS + 41_000, pid: 3101 }),
    logLine("maint.sh", "maintenance finished", { offsetMs: -STOPPED_AGO_MS + 42_000, pid: 3101 }),
    putFile("/var/log/maint/maintenance.log", {
      content: [
        "[08:19:00] maintenance started (log cleanup)",
        "[08:19:59] stopping nginx before cleanup",
        "[08:20:40] removed 14 rotated logs under /var/log/nginx",
        "[08:20:41] restart step skipped (--no-restart)",
        "[08:20:42] maintenance finished",
      ].join("\n") + "\n",
      owner: "root",
      mtimeOffsetMs: -STOPPED_AGO_MS + 42_000,
    }),
  ],

  rootCause: {
    answerId: "stopped-not-started",
    choices: [
      {
        id: "stopped-not-started",
        label: "아침 점검 때 nginx를 내린 뒤 다시 켜지 않아 꺼진 채로 남아 있다",
      },
      {
        id: "crashed",
        label: "nginx가 오류로 죽었다(크래시)",
        whyWrong: "오류로 죽었다면 systemctl status가 failed로 나오고 로그에 오류가 남습니다. 여기서는 inactive (dead)이고, 로그에는 누군가 정상적으로 내린 'Stopped' 기록만 있습니다.",
      },
      {
        id: "disk-full",
        label: "디스크가 가득 차서 nginx가 로그를 쓰지 못했다",
        whyWrong: "디스크 문제라면 로그에 'No space left on device'가 남습니다. df -h로 봐도 공간은 넉넉합니다.",
      },
      {
        id: "dns",
        label: "도메인(DNS) 설정이 바뀌어 사람들이 다른 서버로 가고 있다",
        whyWrong: "서버 안에서 웹 서버 자체가 꺼져 있습니다. 이름 해석을 의심하기 전에, 요청을 받을 프로그램이 살아 있는지가 먼저입니다.",
      },
    ],
  },

  hints: [
    "사이트가 안 열린다는 건 결과입니다. 요청을 받아야 할 웹 서버 프로그램은 지금 켜져 있을까요?",
    "`systemctl status nginx` 로 상태를 보고, `journalctl -u nginx` 로 언제 무슨 일이 있었는지 확인해 보세요.",
    "상태가 failed가 아니라 inactive (dead)이고, 로그에 'Stopped nginx.service'가 있습니다. 누가 내렸고 다시 켜지 않았다는 뜻이에요. `sudo systemctl start nginx` 로 켤 수 있습니다.",
  ],

  resolution: serviceIsActive("nginx"),

  solutionPath: [
    "help",
    "systemctl status nginx",
    "journalctl -u nginx",
    "cat /var/log/maint/maintenance.log",
    "sudo systemctl start nginx",
    "systemctl status nginx",
  ],

  postmortem: {
    whatHappened:
      "아침 정기 점검 스크립트(maint.sh)가 로그 정리를 위해 nginx를 내린 뒤, 다시 켜는 단계를 건너뛰고 끝났습니다. 웹 서버가 꺼져 있으니 아침부터 사이트에 연결할 수 없었습니다.",
    whyItHappened:
      "스크립트가 --no-restart 옵션으로 실행되어 재시작 단계를 건너뛰었고, 점검이 끝난 뒤 서비스가 다시 떴는지 확인하는 절차가 없었습니다.",
    howToFix:
      "꺼진 서비스를 `sudo systemctl start nginx` 로 켜고, `systemctl status nginx` 로 active (running)인지 다시 확인합니다.",
    howToPrevent: [
      "1) 점검 스크립트 마지막에 서비스 상태를 확인하고, 내려가 있으면 실패로 끝나게 합니다.",
      "2) 점검이 끝나면 사이트 응답을 확인하는 헬스 체크를 돌리고, 실패하면 담당자에게 알림을 보냅니다.",
      "3) `systemctl enable nginx` 로 재부팅 뒤에도 자동으로 켜지게 해 두고, 점검 절차서에 '켜기·확인' 단계를 명시합니다.",
    ].join("\n"),
    realWorldNote:
      "실무 장애의 상당수는 거창한 버그가 아니라 '바꾸고 되돌리지 않은 것'입니다. 무언가를 내렸다면 다시 올리고, 올렸다면 정말 올라왔는지 확인하는 습관이 가장 싼 예방책입니다.",
  },

  evidence: [
    { kind: "official-doc", title: "systemctl(1) — status: 서비스 상태(active·inactive·failed)", url: "https://www.freedesktop.org/software/systemd/man/latest/systemctl.html" },
    { kind: "official-doc", title: "journalctl(1) — -u: 특정 유닛의 기록 보기", url: "https://www.freedesktop.org/software/systemd/man/latest/journalctl.html" },
  ],
};

export function isTutorial(scenario: Scenario): boolean {
  return scenario.id === tutorialScenario.id;
}
