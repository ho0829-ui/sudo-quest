import { withCommands } from "../engine/commands";
import { all, memoryUsageBelow, serviceIsActive } from "../engine/judge";
import { crashService, logLine } from "../engine/state/faults";
import type { Fault } from "../engine/state/faults";
import type { Scenario } from "../engine/scenario/types";

/** 메모리를 계속 먹고 있는 배치 프로세스. 이 서버 메모리의 4분의 3을 쓴다. */
const LEAK_MEM_KB = 1_500 * 1024;

const runawayBatch: Fault = (state) => {
  state.processes.push({
    pid: 5218,
    user: "ubuntu",
    cpu: 6.2,
    memKB: LEAK_MEM_KB,
    command: "/usr/bin/python3 /opt/batch/report-worker.py --full-export",
  });
};

export const linuxOom: Scenario = {
  id: "linux-oom",
  title: "API 서버가 자꾸 죽어요",
  category: "linux",
  difficulty: 2,

  ticket: [
    "shop-api 서비스가 조금 전에 또 죽었습니다. 오늘만 세 번째입니다.",
    "죽을 때마다 다시 올리면 잠깐 살아났다가 또 죽습니다.",
    "애플리케이션 로그에는 에러 없이 그냥 뚝 끊깁니다. 예외도 안 남고요.",
    "어제 월간 정산 리포트 작업을 새로 돌리기 시작했는데 그것 때문일까요?",
  ].join("\n"),

  learningObjectives: [
    "애플리케이션이 예외 없이 사라지면 외부에서 죽였다는 뜻임을 안다",
    "dmesg 에서 OOM Killer 기록을 찾아 읽는다",
    "죽은 프로세스(피해자)와 메모리를 먹은 프로세스(원인)는 다를 수 있다",
  ],

  host: "ubuntu-web",
  commands: withCommands("free", "ps", "dmesg", "kill", "curl"),

  faults: [
    runawayBatch,
    // OOM Killer가 shop-api를 골라 죽였다
    crashService("shop-api", "killed by OOM killer (signal 9)", { agoMs: 300_000 }),
    logLine("kernel", "report-worker invoked oom-killer: gfp_mask=0x1100cca(GFP_HIGHUSER_MOVABLE), order=0, oom_score_adj=0", {
      priority: "err",
      offsetMs: -300_000,
    }),
    logLine("kernel", "Tasks state (memory values in pages):", { priority: "warning", offsetMs: -300_000 }),
    logLine("kernel", "[  pid  ]   uid  total_vm      rss  oom_score_adj name", {
      priority: "warning",
      offsetMs: -300_000,
    }),
    logLine("kernel", "[   5218]  1000    460800   384000             0 python3", {
      priority: "warning",
      offsetMs: -300_000,
    }),
    logLine("kernel", "[   1340]     0    112640    53760             0 node", {
      priority: "warning",
      offsetMs: -300_000,
    }),
    logLine(
      "kernel",
      "Out of memory: Killed process 1340 (node) total-vm:450560kB, anon-rss:215040kB, file-rss:0kB, shmem-rss:0kB, UID:0 pgtables:960kB oom_score_adj:0",
      { priority: "err", offsetMs: -300_000 },
    ),
    logLine("systemd", "shop-api.service: Main process exited, code=killed, status=9/KILL", {
      unit: "shop-api",
      priority: "err",
      offsetMs: -300_000,
      pid: 1,
    }),
    logLine("systemd", "shop-api.service: Failed with result 'signal'.", {
      unit: "shop-api",
      priority: "err",
      offsetMs: -300_000,
      pid: 1,
    }),
    logLine("sudo", " ubuntu : TTY=pts/1 ; PWD=/opt/batch ; USER=ubuntu ; COMMAND=/usr/bin/python3 /opt/batch/report-worker.py --full-export", {
      offsetMs: -86_400_000,
    }),
  ],

  rootCause: {
    answerId: "oom-batch",
    choices: [
      {
        id: "oom-batch",
        label: "정산 리포트 배치 프로세스가 메모리를 과도하게 점유해, 커널의 OOM Killer가 메모리를 확보하려고 shop-api를 종료시켰다",
      },
      {
        id: "app-bug",
        label: "shop-api 애플리케이션 자체에 메모리 누수가 있어 스스로 죽고 있다",
        whyWrong:
          "그럴듯하지만 ps로 보면 메모리를 크게 쓰는 건 shop-api(210MB)가 아니라 python3 배치 프로세스(1.5GB)입니다. 그리고 OOM 로그에서 oom-killer를 부른 건 report-worker 쪽입니다.",
      },
      {
        id: "disk-full",
        label: "디스크가 가득 차서 애플리케이션이 종료되었다",
        whyWrong:
          "df 로 보면 디스크는 넉넉하고, 커널 로그도 디스크가 아니라 메모리(Out of memory)를 가리킵니다.",
      },
      {
        id: "crash-loop",
        label: "설정 오류로 shop-api가 기동 직후 스스로 종료되는 crash loop 상태다",
        whyWrong:
          "설정 오류라면 에러 로그가 남고 status가 exit-code로 끝납니다. 여기서는 status=9/KILL — 외부에서 SIGKILL을 받아 죽었다는 뜻입니다.",
      },
    ],
  },

  hints: [
    "애플리케이션이 예외 하나 남기지 않고 사라졌다면, 스스로 종료한 게 아니라 누군가가 밖에서 죽였을 가능성이 큽니다. 리눅스에서 프로세스를 강제로 죽일 수 있는 건 누구일까요?",
    "`systemctl status shop-api` 의 종료 코드를 보세요. 그리고 커널이 남긴 기록을 `dmesg -T` 로 확인해 보세요. 메모리 상황은 `free -m` 과 `ps aux` 로 볼 수 있습니다.",
    "커널 로그에 `Out of memory: Killed process 1340 (node)` 가 있습니다. shop-api가 죽은 건 맞지만 범인은 따로 있습니다. `ps aux` 로 메모리를 가장 많이 쓰는 프로세스를 찾아보세요 — python3 배치가 1.5GB를 쓰고 있습니다.",
  ],

  // 메모리를 되찾고 서비스를 다시 올려야 복구다
  resolution: all(serviceIsActive("shop-api"), memoryUsageBelow(85)),

  solutionPath: [
    "systemctl status shop-api",
    "journalctl -u shop-api -n 10",
    "free -m",
    "ps aux",
    "dmesg -T",
    "sudo kill 5218",
    "free -m",
    "sudo systemctl start shop-api",
    "systemctl status shop-api",
  ],

  postmortem: {
    whatHappened:
      "새로 돌리기 시작한 월간 정산 배치(report-worker.py)가 데이터를 전부 메모리에 올리면서 1.5GB를 점유했습니다. 서버 전체 메모리가 2GB뿐이라 여유가 바닥났고, 커널의 OOM Killer가 메모리를 확보하기 위해 프로세스 하나를 골라 SIGKILL로 종료했습니다. 그 대상이 shop-api였습니다. shop-api는 아무 잘못이 없었고, 그래서 애플리케이션 로그에도 아무 흔적이 남지 않았습니다.",
    whyItHappened:
      "배치 작업이 전체 데이터를 한 번에 메모리로 읽어 들이는 방식으로 작성되었고, 메모리 사용량 제한 없이 운영 서버에서 실행되었습니다. OOM Killer는 메모리를 많이 쓰는 프로세스를 죽이는 게 아니라 oom_score 점수로 대상을 고르기 때문에, 원인이 아닌 프로세스가 희생될 수 있습니다.",
    howToFix:
      "메모리를 점유한 배치 프로세스를 종료해 여유를 확보하고, shop-api를 다시 시작합니다. 다만 이건 응급 처치입니다 — 배치를 다시 돌리면 같은 일이 반복됩니다.",
    howToPrevent: [
      "1) 배치를 운영 서버가 아닌 별도 워커 서버에서 돌립니다.",
      "2) systemd 유닛에 MemoryMax= 를 걸어 배치가 쓸 수 있는 메모리를 제한합니다. 그러면 배치만 죽고 서비스는 살아남습니다.",
      "3) 배치를 스트리밍/청크 방식으로 고쳐 전체 데이터를 메모리에 올리지 않게 합니다.",
      "4) 메모리 사용률과 OOM 이벤트를 모니터링합니다. dmesg의 oom-killer 발생은 반드시 알림으로 받아야 합니다.",
      "5) 중요 서비스에는 OOMScoreAdjust= 를 낮게 줘서 OOM Killer의 선택에서 뒤로 밀어둡니다.",
    ].join("\n"),
    realWorldNote:
      "OOM 장애의 함정은 '죽은 프로세스가 범인이 아니다'라는 점입니다. 로그만 보면 shop-api가 문제인 것 같지만 실제 원인은 다른 프로세스입니다. 애플리케이션이 예외 없이 사라졌다면 항상 `dmesg | grep -i oom` 을 먼저 확인하세요.",
  },
};
