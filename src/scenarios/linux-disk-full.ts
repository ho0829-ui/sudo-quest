import { all, diskUsageBelow, serviceIsActive } from "../engine/judge";
import { crashService, logLine, putFile } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/** 폭증한 애플리케이션 로그. 8GB 디스크를 거의 다 먹는 크기다. */
const FLOOD_LOG_KB = 6_150_000;

const floodSample = [
  "2026-09-11 08:58:01.221 DEBUG [http-nio-3000-exec-7] OrderRepository - executing query: SELECT * FROM orders WHERE status = 'PENDING'",
  "2026-09-11 08:58:01.223 DEBUG [http-nio-3000-exec-7] OrderRepository - query returned 0 rows in 2ms",
  "2026-09-11 08:58:01.224 DEBUG [http-nio-3000-exec-7] CacheManager - cache miss for key=orders:pending",
  "2026-09-11 08:58:01.310 DEBUG [http-nio-3000-exec-3] OrderRepository - executing query: SELECT * FROM orders WHERE status = 'PENDING'",
  "2026-09-11 08:58:01.311 DEBUG [http-nio-3000-exec-3] CacheManager - cache miss for key=orders:pending",
].join("\n");

export const linuxDiskFull: Scenario = {
  id: "linux-disk-full",
  title: "웹사이트가 갑자기 안 열려요",
  category: "linux",
  difficulty: 1,

  ticket: [
    "안녕하세요, 운영팀입니다.",
    "오전 9시쯤부터 쇼핑몰 사이트(web-01)에 접속이 안 된다는 문의가 계속 들어오고 있습니다.",
    "브라우저에서는 아무것도 안 뜨고 계속 로딩만 됩니다.",
    "어제까지는 멀쩡했고, 저희 쪽에서 배포하거나 설정을 바꾼 건 없습니다.",
    "확인 부탁드립니다!",
  ].join("\n"),

  learningObjectives: [
    "서비스가 죽었을 때 systemctl status와 journalctl로 실패 사유를 먼저 확인한다",
    "df와 du로 디스크를 넓은 곳에서 좁은 곳으로 좁혀 들어간다",
    "원인을 제거한 뒤 서비스는 스스로 살아나지 않는다는 것을 안다 (재시작이 필요하다)",
  ],

  host: "ubuntu-web",

  faults: [
    // 1) 앱이 DEBUG 로그를 쏟아내 디스크를 채웠다
    putFile("/var/log/app/app.log", {
      sizeKB: FLOOD_LOG_KB,
      content: floodSample + "\n",
      owner: "root",
      mtimeOffsetMs: -30_000,
    }),

    // 2) 그 결과 nginx가 로그를 쓰지 못해 죽었다
    crashService("nginx", "No space left on device", { agoMs: 880_000 }),

    // 3) 죽기까지의 흔적을 로그로 남긴다 (플레이어가 찾아야 할 단서)
    logLine("CRON", "(root) CMD (/usr/local/bin/log-rotate.sh)", { offsetMs: -3_000_000, pid: 2240 }),
    logLine("nginx", "open() \"/var/log/nginx/access.log\" failed (28: No space left on device)", {
      unit: "nginx",
      priority: "err",
      offsetMs: -900_000,
      pid: 1102,
    }),
    logLine("systemd", "nginx.service: Main process exited, code=exited, status=1/FAILURE", {
      unit: "nginx",
      pid: 1,
      priority: "err",
      offsetMs: -880_000,
    }),
    logLine("systemd", "nginx.service: Failed with result 'exit-code'.", {
      unit: "nginx",
      pid: 1,
      priority: "err",
      offsetMs: -880_000,
    }),
    logLine("systemd", "Failed to start nginx.service - A high performance web server and a reverse proxy server.", {
      unit: "nginx",
      pid: 1,
      priority: "err",
      offsetMs: -880_000,
    }),
    // 원인과 무관한 정상 로그도 섞는다. 실제 서버 로그는 깨끗하지 않다.
    logLine("systemd", "Started Daily apt download activities.", { offsetMs: -600_000, pid: 1 }),
    logLine("sshd", "Accepted publickey for ubuntu from 10.0.1.55 port 51402 ssh2", {
      offsetMs: -120_000,
      pid: 2501,
    }),
  ],

  rootCause: {
    answerId: "disk-full",
    choices: [
      {
        id: "disk-full",
        label: "애플리케이션 로그가 디스크를 가득 채워, nginx가 로그 파일을 쓰지 못해 기동에 실패했다",
      },
      {
        id: "oom",
        label: "메모리가 부족해 OOM Killer가 nginx 프로세스를 종료시켰다",
        whyWrong:
          "그럴듯하지만 로그에 OOM 기록이 없습니다. OOM이라면 journalctl에 'Out of memory: Killed process' 같은 커널 메시지가 남습니다.",
      },
      {
        id: "port-conflict",
        label: "다른 프로세스가 80 포트를 먼저 점유해 nginx가 바인딩에 실패했다",
        whyWrong:
          "포트 충돌이라면 로그에 'Address already in use'가 찍힙니다. 여기 찍힌 건 'No space left on device'입니다.",
      },
      {
        id: "config-error",
        label: "nginx 설정 파일에 문법 오류가 있어 기동에 실패했다",
        whyWrong:
          "설정 오류라면 문법 오류 위치가 로그에 나옵니다. 게다가 이번엔 아무도 설정을 바꾸지 않았습니다.",
      },
    ],
  },

  hints: [
    "웹사이트가 안 뜬다는 건 결과일 뿐입니다. 그 앞단의 웹 서버는 지금 살아 있을까요? 죽었다면 왜 죽었는지 어딘가에 기록을 남기지 않았을까요?",
    "서비스 상태와 그 서비스가 남긴 로그부터 확인해 보세요. `systemctl status nginx` 와 `journalctl -u nginx` 가 출발점입니다.",
    "로그에 `No space left on device` 가 보입니다. 디스크가 가득 찼다는 뜻이에요. `df -h` 로 전체를 보고, `du -sh /var/log/*` 로 어디가 범인인지 좁혀 보세요.",
  ],

  // 디스크를 비우는 것만으로는 부족하다. nginx는 스스로 살아나지 않는다.
  resolution: all(diskUsageBelow("/", 90), serviceIsActive("nginx")),

  solutionPath: [
    "systemctl status nginx",
    "journalctl -u nginx -n 20",
    "df -h",
    "du -sh /var/log/*",
    "ls -lh /var/log/app",
    "sudo rm /var/log/app/app.log",
    "df -h",
    "sudo systemctl restart nginx",
    "systemctl status nginx",
  ],

  postmortem: {
    whatHappened:
      "shop-api 애플리케이션이 DEBUG 레벨 로그를 대량으로 남기면서 /var/log/app/app.log 파일이 약 5.9GB까지 커졌고, 8GB 루트 디스크가 100%로 찼습니다. 디스크에 쓸 공간이 없어지자 nginx는 액세스 로그를 기록하지 못하고 종료되었으며, 그 결과 사이트 접속이 끊겼습니다.",
    whyItHappened:
      "애플리케이션이 운영 환경에서 DEBUG 로그 레벨로 동작하고 있었고, 해당 로그 파일에는 로테이션(logrotate) 설정이 걸려 있지 않았습니다. 매일 조금씩 쌓이던 로그가 임계점을 넘는 순간 장애로 드러났습니다.",
    howToFix:
      "가득 찬 파일을 제거하거나 비워 공간을 확보한 뒤(`rm` 또는 `> 파일`), nginx를 재시작합니다. 원인을 없애도 죽은 서비스는 자동으로 살아나지 않으므로 `systemctl restart nginx` 가 반드시 필요합니다.",
    howToPrevent: [
      "1) 로그 로테이션: /etc/logrotate.d 에 앱 로그 설정을 추가해 일 단위로 압축·보관하고 오래된 것은 삭제합니다.",
      "2) 로그 레벨: 운영 환경은 INFO 이상으로 낮춥니다. DEBUG는 문제를 재현할 때만 임시로 켭니다.",
      "3) 모니터링/알림: 디스크 사용률 80%에서 경고, 90%에서 호출 알림을 보냅니다. 100%가 되고 나서 알면 이미 장애입니다.",
      "4) 분리: /var/log 를 별도 볼륨으로 분리하면 로그가 넘쳐도 시스템 전체가 멈추지는 않습니다.",
    ].join("\n"),
    realWorldNote:
      "실무에서 가장 흔한 함정은 `rm` 으로 파일을 지웠는데도 `df` 사용량이 그대로인 경우입니다. 프로세스가 그 파일을 아직 열고 있으면 공간이 반환되지 않기 때문입니다. 이때는 `lsof +L1` 로 확인하고, 해당 프로세스를 재시작하거나 `truncate -s 0` 로 파일을 비워야 합니다.",
  },
  // 이 장애가 실제로 일어나는 일이라는 근거. 원인을 드러내므로 클리어 리포트에서만 보여 준다.
  evidence: [
    { kind: "official-doc", title: "errno(3) — ENOSPC: No space left on device", url: "https://man7.org/linux/man-pages/man3/errno.3.html" },
    { kind: "official-doc", title: "write(2) — ENOSPC: 장치에 데이터를 쓸 공간이 없음", url: "https://man7.org/linux/man-pages/man2/write.2.html" },
  ],
};
