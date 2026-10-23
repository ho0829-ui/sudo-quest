import { withCommands } from "../engine/commands/names";
import type { Scenario } from "../engine/scenario/types";
import { diskUsage, mountFor } from "../engine/state/derived";
import { createContainer, startContainer, stopContainer } from "../engine/state/docker/lifecycle";
import { containerView } from "../engine/state/docker/runtime";
import { addBuildCache, addImage, containerIntact, DOCKER_ROOT, imageIntact, type NewImage } from "../engine/state/docker/storage";
import { writeFile } from "../engine/state/fs";
import type { SystemState } from "../engine/state/types";

const DAY = 86_400_000;
const GB = 1024 * 1024; // KB
const ENV = { DATABASE_URL: "postgres://shop@db.internal:5432/shop", NODE_ENV: "production" };
const TAGS = ["2.0.0", "2.0.1", "2.0.2", "2.0.3", "2.0.4", "2.0.5", "2.0.6", "2.0.7", "2.0.8", "2.0.9", "2.1.0-rc.1", "2.1.0-rc.2", "2.1.0-rc.3", "2.1.0"];

/** 버전마다 의존성(780MB)과 앱(420MB) 레이어가 따로 있고, node 베이스 레이어는 모두 공유한다. */
function shopApi(tag: string, createdAt: number, deps: string, appMB: number, key?: string): NewImage {
  return {
    repository: key ? "<none>" : "shop-api", tag: key ? "<none>" : tag, createdAt, key,
    layers: [{ name: "node:20-bookworm-slim", sizeMB: 75.2 }, { name: `shop-api:${deps}:deps`, sizeMB: 780 }, { name: `shop-api:${key ?? tag}:app`, sizeMB: appMB }],
    cmd: ["docker-entrypoint.sh", "node", "server.js"], env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", NODE_VERSION: "20.15.1" },
    profile: { ports: [8080], paths: ["/healthz"], requiredEnv: ["DATABASE_URL"],
      headers: { "X-Powered-By": "Express", "Content-Type": "application/json; charset=utf-8" },
      responses: { "/version": `{"service":"shop-api","version":"${tag}"}`, "/healthz": '{"status":"ok"}' },
      log: { boot: [`> shop-api@${tag} start`, "> node server.js"], ready: [`[info] shop-api ${tag} listening on :8080`] } },
  };
}

/** 판정: /var/lib/docker 디스크 사용률이 80% 이하이고, 실행 중이던 두 컨테이너와 그 이미지 레이어가 온전하다. */
function recovered(state: SystemState): boolean {
  const usage = diskUsage(state, mountFor(state, DOCKER_ROOT).mount);
  const alive = (name: string) => {
    const container = state.docker?.containers.find(c => c.name === name);
    const image = state.docker?.images.find(i => i.id === container?.imageId);
    return !!container && !!image && containerView(container, state.clock).status === "running" && imageIntact(state, image) && containerIntact(state, container);
  };
  return usage.usePercent <= 80 && alive("shop-api") && alive("status-page");
}

export const dockerDiskFull: Scenario = {
  id: "docker-disk-full",
  title: "오늘 배포 빌드가 계속 실패해요",
  category: "docker",
  difficulty: 2,
  ticket: [
    "오늘 07:30부터 shop-api 2.2.0 릴리스 빌드가 계속 실패합니다. 지금 서비스(2.1.0)는 정상이지만 오후 배포가 막혀 있어요.",
    "빌드는 app-01 서버에서 직접 합니다. 빌드 스크립트는 /opt/deploy, 빌드 로그는 /var/log/deploy에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "df -h로 어느 디스크(마운트)가 찼는지 먼저 확인한다",
    "docker system df로 이미지·빌드 캐시의 크기와 지울 수 있는 양(RECLAIMABLE)을 읽는다",
    "/var/lib/docker를 손으로 지우지 않고 docker prune 명령으로 실행 중인 서비스를 지키며 정리한다",
  ],
  host: "docker-host",
  commands: withCommands("docker", "curl", "ss", "ps"),
  faults: [(state) => {
    // 이 서버는 Docker 데이터용 디스크를 따로 붙였다. 크기는 마지막에 사용량에 맞춰 정한다(가득 찬 상태).
    state.disks.push({ device: "/dev/nvme1n1", mount: DOCKER_ROOT, totalKB: 64 * GB, reservedKB: 0.4 * GB });
    TAGS.forEach((tag, index) => addImage(state, shopApi(tag, state.clock - (40 - index * 2.5) * DAY, tag, 420)));
    // 30분마다 dev 태그로 다시 빌드해, 이름을 빼앗긴 옛 dev 이미지가 <none>으로 쌓였다.
    for (let i = 0; i < 25; i++) addImage(state, shopApi("dev", state.clock - (13 - i * 0.5) * DAY, "dev", 300, `dev-build-${i}`));
    for (let i = 0; i < 140; i++) {
      addBuildCache(state, { name: `build-${i}`, sizeMB: i < 120 ? 200 : 100, lastUsed: state.clock - (30 - i * 0.2) * DAY, dangling: i < 120,
        description: i % 3 === 0 ? "[5/6] RUN npm ci --omit=dev" : i % 3 === 1 ? "[6/6] COPY . ." : "mount / from exec /bin/sh -c npm run build" });
    }
    const run = (name: string, tag: string, created: number, rwMB: number, ports = false) => {
      const result = createContainer(state, { name, image: `shop-api:${tag}`, env: ENV, createdAt: created, rwMB, logMB: 6,
        restart: { name: "unless-stopped", maximumRetryCount: 0 }, ports: ports ? [{ hostIp: "", hostPort: 8080, containerPort: 8080, proto: "tcp" }] : [] });
      if (result.ok) startContainer(state, result.container, created);
      return result.ok ? result.container : undefined;
    };
    for (const tag of ["2.0.8", "2.0.9"]) {
      const old = run(`shop-api-${tag}`, tag, state.clock - 12 * DAY, 8);
      if (old) stopContainer(state, old, true, state.clock - 3 * DAY);
    }
    run("shop-api", "2.1.0", state.clock - 3 * DAY, 12, true);
    const failedAt = state.clock - 105 * 60_000;
    writeFile(state.fs, "/opt/deploy/build.sh", { mode: 0o755, mtime: state.clock - 60 * DAY, content: [
      "#!/bin/bash", "# CI 대신 이 서버에서 직접 빌드한다 (cron: */30 * * * *, /etc/cron.d/shop-api-build)",
      "cd /srv/shop-api && git pull -q", "docker build -t shop-api:dev .",
      "# 릴리스: VERSION=x.y.z ./build.sh 뒤 docker build -t shop-api:$VERSION . && ./deploy.sh $VERSION",
    ].join("\n") });
    writeFile(state.fs, "/var/log/deploy/build-2.2.0.log", { mtime: failedAt, content: [
      "#0 building with \"default\" instance using docker driver",
      "#1 [internal] load build definition from Dockerfile", "#1 transferring dockerfile: 612B done", "#1 DONE 0.0s",
      "#2 [internal] load metadata for docker.io/library/node:20-bookworm-slim", "#2 DONE 0.7s",
      "#5 [1/6] FROM docker.io/library/node:20-bookworm-slim", "#5 CACHED",
      "#8 [4/6] COPY package.json package-lock.json ./", "#8 DONE 0.1s",
      "#9 [5/6] RUN npm ci --omit=dev", "#9 ERROR: failed to copy files: copy file range failed: no space left on device",
      "------", " > [5/6] RUN npm ci --omit=dev:", "------",
      `ERROR: failed to solve: write ${DOCKER_ROOT}/buildkit/content/ingest/5f1c09e2/data: no space left on device`,
    ].join("\n") });
    state.journal.push({ time: failedAt, tag: "dockerd", unit: "docker", pid: 905, priority: "err",
      message: `level=error msg="failed to write blob" error="write ${DOCKER_ROOT}/buildkit/content/ingest/5f1c09e2/data: no space left on device"` });
    // 사용량에 남은 공간 200KB만 더해 디스크 크기를 정한다(새 컨테이너도 못 만들 만큼). 이후 사용량은 파일에서 계산된다.
    const disk = state.disks.find(d => d.mount === DOCKER_ROOT)!;
    disk.totalKB = diskUsage(state, DOCKER_ROOT).usedKB + 200;
  }],
  rootCause: {
    answerId: "docker-data-full",
    choices: [
      { id: "docker-data-full", label: "서버에서 반복 빌드하며 쌓인 빌드 캐시와 쓰지 않는 이미지가 /var/lib/docker 디스크를 가득 채웠다" },
      { id: "root-full", label: "루트(/) 디스크가 가득 찼다",
        whyWrong: "`df -h`에서 /는 여유가 있습니다. 가득 찬 것은 /var/lib/docker에 마운트된 /dev/nvme1n1입니다." },
      { id: "container-logs", label: "실행 중인 컨테이너의 로그가 디스크를 채웠다",
        whyWrong: "`sudo du -sh /var/lib/docker/*`에서 containers는 수십 MB입니다. 대부분은 overlay2(이미지 레이어)와 buildkit(빌드 캐시)입니다." },
      { id: "oom", label: "빌드 중 메모리가 부족해 npm ci가 죽었다",
        whyWrong: "빌드 로그의 오류는 no space left on device(ENOSPC)입니다. 메모리 부족이라면 Killed나 종료 코드 137이 남습니다." },
      { id: "registry", label: "레지스트리에서 베이스 이미지를 받지 못했다",
        whyWrong: "로그에서 FROM 단계는 CACHED로 끝났고, 실패는 그다음 레이어를 디스크에 쓰는 단계입니다." },
    ],
  },
  hints: [
    "빌드가 마지막에 남긴 오류부터 읽어 보세요. 그리고 서버의 '디스크'가 하나뿐인지도 확인해 보세요.",
    "`df -h`로 어느 마운트가 찼는지, `sudo du -sh /var/lib/docker/*`와 `docker system df`로 Docker가 무엇에 공간을 쓰고 얼마나 되찾을 수 있는지 보세요.",
    "빌드 캐시와 쓰지 않는 이미지가 대부분이네요. `docker builder prune -f`와 `docker image prune -a -f`로 정리하세요. /var/lib/docker 안을 rm으로 지우면 실행 중인 컨테이너가 깨집니다.",
  ],
  resolution: recovered,
  solutionPath: [
    "tail -n 3 /var/log/deploy/build-2.2.0.log",
    "df -h",
    "sudo du -sh /var/lib/docker/*",
    "docker system df",
    "docker images -f dangling=true -q | wc -l",
    "docker ps -a",
    "docker builder prune -f",
    "docker image prune -a -f",
    "docker system df",
    "df -h",
  ],
  postmortem: {
    whatHappened: "app-01에서 30분마다 직접 이미지를 빌드하면서 빌드 캐시(약 25GB), 이름이 떨어져 나간 dev 이미지(<none>), 지난 릴리스 이미지가 /var/lib/docker 디스크(/dev/nvme1n1)를 가득 채웠습니다. 2.2.0 빌드는 레이어를 쓰다가 no space left on device로 실패했습니다.",
    whyItHappened: "같은 태그(shop-api:dev)로 다시 빌드하면 옛 이미지는 지워지지 않고 <none>으로 남고, BuildKit 캐시도 계속 쌓입니다. 정리 작업과 Docker 디스크 사용량 경보가 없었습니다.",
    howToFix: "`docker system df`로 지울 수 있는 양을 확인하고 `docker builder prune -f`, `docker image prune -a -f`로 정리한 뒤 `df -h`로 확인합니다. 멈춘 옛 컨테이너가 이미지를 붙잡고 있으면 `docker container prune -f`를 먼저 합니다. /var/lib/docker 아래를 rm으로 지우면 Docker가 관리하는 레이어가 깨져 실행 중인 컨테이너까지 망가집니다.",
    howToPrevent: [
      "1) 빌드는 CI 러너에서 하고, 서버는 레지스트리에서 받은 이미지만 실행합니다.",
      "2) 정기 정리(예: docker image prune -a --filter until=168h, docker builder prune)와 BuildKit 캐시 상한(gc 설정)을 둡니다.",
      "3) /var/lib/docker 디스크 사용률 경보(80%)를 두고, 릴리스 이미지는 최근 몇 개만 남기는 보존 정책을 정합니다.",
    ].join("\n"),
    realWorldNote: "Docker 데이터는 레이어를 여러 이미지가 공유하므로 docker images의 SIZE를 더하면 실제 사용량보다 커집니다. 실제 사용량과 되찾을 수 있는 양은 docker system df가 보여 줍니다. 이 실습은 이미지 빌드(docker build)와 볼륨을 재현하지 않으며, -f 없는 prune은 확인 질문에 답할 수 없어 아무것도 지우지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Docker — docker system df", url: "https://docs.docker.com/reference/cli/docker/system/df/" },
    { kind: "official-doc", title: "Docker — Prune unused Docker objects: Prune images", url: "https://docs.docker.com/engine/manage-resources/pruning/#prune-images" },
    { kind: "official-doc", title: "Docker — Prune unused Docker objects: Prune build cache", url: "https://docs.docker.com/engine/manage-resources/pruning/#prune-build-cache" },
  ],
};
