import { withCommands } from "../engine/commands";
import type { Scenario } from "../engine/scenario/types";
import { hexId } from "../engine/state/docker/format";
import { createContainer, startContainer } from "../engine/state/docker/lifecycle";
import { containerView } from "../engine/state/docker/runtime";
import { writeFile } from "../engine/state/fs";
import type { SystemState } from "../engine/state/types";

const IMAGE = "notify-worker:1.4.0";
const SHARED = { SMTP_HOST: "smtp.example.com", SMTP_USER: "noreply@shop.example.com", QUEUE_URL: "redis://queue.internal:6379/0" };

/** 판정: 같은 이미지로 만든 컨테이너가 실행 중이다. 필수 환경 변수가 모두 있어야만 실행 상태가 되므로 이것으로 충분하다. */
function workerRunning(state: SystemState): boolean {
  const image = state.docker?.images.find(i => `${i.repository}:${i.tag}` === IMAGE);
  return !!image && !!state.docker?.containers.some(c => c.imageId === image.id && containerView(c, state.clock).status === "running");
}

export const dockerMissingEnv: Scenario = {
  id: "docker-missing-env",
  title: "가입 인증 메일이 오지 않아요",
  category: "docker",
  difficulty: 2,
  ticket: [
    "오늘 아침부터 회원가입 인증 메일과 비밀번호 재설정 메일이 오지 않는다는 문의가 이어지고 있습니다.",
    "메일은 app-01 서버의 notify-worker 컨테이너가 큐에서 꺼내 보냅니다. 웹 화면과 주문은 정상입니다.",
    "오늘 08:30에 notify-worker를 새 서버(app-01)로 옮겨 다시 띄웠습니다. 작업 파일은 /opt/notify에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "docker ps에 보이지 않는 컨테이너를 docker ps -a로 찾고, 종료 코드와 재시작 횟수를 읽는다",
    "docker logs와 docker inspect의 Config.Env로 빠진 설정을 확인한다",
    "컨테이너의 환경 변수는 만든 뒤 바꿀 수 없어 다시 만들어야 한다는 점과 -e KEY(값 없음)의 동작을 이해한다",
  ],
  host: "docker-host",
  commands: withCommands("docker", "curl", "ss", "ps"),
  faults: [(state) => {
    const docker = state.docker!;
    const moved = state.clock - 45 * 60_000;
    docker.images.push({
      repository: "notify-worker", tag: "1.4.0", id: hexId(`image:${IMAGE}`), createdAt: state.clock - 14 * 86_400_000, sizeMB: 96.4,
      cmd: ["python", "-m", "notify.worker"], env: { PATH: "/usr/local/bin:/usr/local/sbin:/usr/sbin:/usr/bin:/sbin:/bin", PYTHON_VERSION: "3.12.4" },
      profile: {
        ports: [], paths: [], requiredEnv: ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "QUEUE_URL"],
        log: { boot: ["INFO  notify-worker 1.4.0 starting", "INFO  loading configuration from environment"],
          ready: ["INFO  smtp: smtp.example.com:587 (STARTTLS) as noreply@shop.example.com", "INFO  queue: redis://queue.internal:6379/0", "INFO  waiting for jobs"] },
      },
    });
    // 장애: run.sh가 -e SMTP_PASSWORD처럼 값 없이 넘겼는데, 실행한 셸에 export된 값이 없어 컨테이너에 들어가지 않았다.
    const created = createContainer(docker, { name: "notify-worker", image: IMAGE, env: SHARED, createdAt: moved,
      restart: { name: "on-failure", maximumRetryCount: 5 } });
    if (created.ok) startContainer(state, created.container, moved);
    writeFile(state.fs, "/opt/notify/run.sh", { mode: 0o755, owner: "ubuntu", group: "ubuntu", mtime: moved - 600_000, content: [
      "#!/bin/bash", "# notify-worker 실행 (서버 이전 2026-09-11)",
      "# SMTP_PASSWORD는 비밀값이라 이 파일에 적지 않는다. 실행 전에 셸에서 export 할 것.",
      "docker run -d --name notify-worker --restart on-failure:5 \\",
      `  -e SMTP_HOST=${SHARED.SMTP_HOST} \\`, `  -e SMTP_USER=${SHARED.SMTP_USER} \\`, "  -e SMTP_PASSWORD \\",
      `  -e QUEUE_URL=${SHARED.QUEUE_URL} \\`, `  ${IMAGE}`,
    ].join("\n") });
    writeFile(state.fs, "/opt/notify/notify.env", { mode: 0o600, owner: "ubuntu", group: "ubuntu", mtime: moved - 86_400_000, content: [
      "# notify-worker 운영 설정 (보안팀 관리, 권한 600)",
      ...Object.entries(SHARED).map(([key, value]) => `${key}=${value}`),
      "SMTP_PASSWORD=virtual-lab-not-a-real-secret",
    ].join("\n") });
    writeFile(state.fs, "/opt/notify/README.md", { owner: "ubuntu", group: "ubuntu", mtime: moved - 86_400_000, content: [
      "# notify-worker", "",
      "메일 발송 워커. 큐에서 작업을 꺼내 SMTP로 보낸다.", "",
      "## 운영 서버 설정",
      "- 비밀값을 포함한 설정은 notify.env에 둔다(보안팀 관리). 셸 기록에 비밀값을 남기지 않는다.",
      "- 컨테이너 환경 변수는 만든 뒤 바꿀 수 없다. 설정을 바꾸면 컨테이너를 지우고 다시 만든다.",
    ].join("\n") });
  }],
  rootCause: {
    answerId: "env-not-passed",
    choices: [
      { id: "env-not-passed", label: "실행 스크립트가 -e SMTP_PASSWORD처럼 값 없이 넘겨, 셸에 값이 없던 컨테이너에 비밀번호가 들어가지 않았다" },
      { id: "smtp-down", label: "외부 SMTP 서버 장애로 메일을 보내지 못한다",
        whyWrong: "`docker logs notify-worker`는 설정을 읽는 단계에서 FATAL로 끝납니다. SMTP 서버에 연결을 시도하기도 전입니다." },
      { id: "oom", label: "메모리가 부족해 커널이 컨테이너를 죽였다",
        whyWrong: "`docker inspect notify-worker`의 State.ExitCode는 1이고 OOMKilled는 false입니다. 메모리 초과라면 137과 OOMKilled true가 보입니다." },
      { id: "image-broken", label: "이미지가 손상돼 실행 파일을 찾지 못한다",
        whyWrong: "로그에 notify-worker 1.4.0 starting이 찍혀 앱이 실행됐습니다. 실행 파일이 없으면 앱 로그 없이 126·127 같은 코드로 끝납니다." },
      { id: "queue", label: "큐(redis) 주소가 바뀌어 작업을 가져오지 못한다",
        whyWrong: "Config.Env에 QUEUE_URL은 들어 있고, 앱은 큐에 연결하기 전에 설정 오류로 끝납니다." },
    ],
  },
  hints: [
    "목록에 보이지 않는다고 컨테이너가 없는 건 아니에요. 멈춘 컨테이너가 마지막으로 남긴 말을 볼 수 있지 않을까요?",
    "`docker ps -a`, `docker logs notify-worker`, `docker inspect notify-worker`의 Config.Env, 그리고 `/opt/notify`의 파일을 보세요.",
    "SMTP_PASSWORD가 Env에 없네요. 환경 변수는 바꿀 수 없으니 `docker rm notify-worker` 후 `docker run -d --name notify-worker --restart on-failure:5 --env-file /opt/notify/notify.env notify-worker:1.4.0`으로 다시 만드세요.",
  ],
  resolution: workerRunning,
  solutionPath: [
    "docker ps",
    "docker ps -a",
    "docker logs notify-worker --tail 5",
    "docker inspect -f '{{.State.ExitCode}} {{.RestartCount}} {{.Config.Env}}' notify-worker",
    "cat /opt/notify/run.sh",
    "ls -l /opt/notify",
    "cat /opt/notify/README.md",
    "docker rm notify-worker",
    "docker run -d --name notify-worker --restart on-failure:5 --env-file /opt/notify/notify.env notify-worker:1.4.0",
    "docker ps",
    "docker logs notify-worker",
  ],
  postmortem: {
    whatHappened: "08:30 notify-worker를 새 서버에서 다시 띄웠지만, 컨테이너에 SMTP_PASSWORD가 들어가지 않아 시작하자마자 설정 오류(종료 코드 1)로 끝났습니다. on-failure:5 정책으로 다섯 번 다시 시작한 뒤 멈췄고(Exited (1)), 그동안 메일 작업이 처리되지 않았습니다.",
    whyItHappened: "run.sh는 비밀값을 파일에 적지 않으려고 -e SMTP_PASSWORD처럼 값 없이 넘겼습니다. 이 경우 docker는 실행한 셸의 값을 넘기는데, 이전 작업을 한 셸에 export가 없어 변수가 아예 빠졌습니다. 보안팀이 만든 notify.env를 쓰라는 안내는 반영되지 않았습니다.",
    howToFix: "`docker rm notify-worker`로 지우고 `docker run -d --name notify-worker --restart on-failure:5 --env-file /opt/notify/notify.env notify-worker:1.4.0`으로 다시 만든 뒤, `docker ps`와 `docker logs notify-worker`로 waiting for jobs를 확인합니다. docker restart나 docker start는 같은 설정으로 다시 띄울 뿐이라 고쳐지지 않습니다.",
    howToPrevent: [
      "1) 비밀값은 셸 export에 기대지 말고 권한을 제한한 --env-file이나 비밀 저장소에서 넣습니다.",
      "2) 앱이 시작할 때 필수 설정을 검사해 바로 실패하게 하고(지금처럼), 컨테이너 종료·재시작 경보를 둡니다.",
      "3) 서버 이전 체크리스트에 \"docker ps로 Up 확인, 로그의 준비 완료 줄 확인\"을 넣습니다.",
    ].join("\n"),
    realWorldNote: "Docker 문서: -e에 값 없이 이름만 주면 로컬 환경의 값을 넘기고, 로컬에서 export되지 않았다면 컨테이너에는 그 변수가 설정되지 않습니다. 이 실습의 가상 셸에는 export된 값이 없습니다. 재시작 지연(100ms부터 두 배)은 시각으로 계산하며, 다시 만든 직후의 재시도 과정은 실제보다 단순합니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Docker — docker container run: Set environment variables (-e, --env, --env-file)", url: "https://docs.docker.com/reference/cli/docker/container/run/#env" },
    { kind: "official-doc", title: "Docker — docker container run: Restart policies (--restart)", url: "https://docs.docker.com/reference/cli/docker/container/run/#restart" },
    { kind: "official-doc", title: "Docker — docker container logs", url: "https://docs.docker.com/reference/cli/docker/container/logs/" },
  ],
};
