import { withCommands } from "../engine/commands";
import type { Scenario } from "../engine/scenario/types";
import { portOwner } from "../engine/state/derived";
import { createContainer, startContainer } from "../engine/state/docker/lifecycle";
import { containerView } from "../engine/state/docker/runtime";
import { addImage, type NewImage } from "../engine/state/docker/storage";
import { writeFile } from "../engine/state/fs";
import type { SystemState } from "../engine/state/types";

const DAY = 86_400_000;
const ENV = { DATABASE_URL: "postgres://shop@db.internal:5432/shop", NODE_ENV: "production" };

function shopApi(version: string, createdAt: number, extra: Record<string, string>): NewImage {
  return {
    repository: "shop-api", tag: version, createdAt,
    layers: [{ name: "node:20-bookworm-slim", sizeMB: 75.2 }, { name: `shop-api:${version}:deps`, sizeMB: 92.1 }, { name: `shop-api:${version}:app`, sizeMB: 14.6 }],
    cmd: ["docker-entrypoint.sh", "node", "server.js"], env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", NODE_VERSION: "20.15.1" },
    profile: {
      ports: [8080], paths: ["/healthz"], requiredEnv: ["DATABASE_URL"],
      headers: { "X-Powered-By": "Express", "Content-Type": "application/json; charset=utf-8" },
      responses: { "/version": `{"service":"shop-api","version":"${version}"}`, "/healthz": '{"status":"ok"}', ...extra },
      log: { boot: [`> shop-api@${version} start`, "> node server.js", "[info] connecting to postgres at db.internal:5432"],
        ready: [`[info] shop-api ${version} listening on :8080`] },
    },
  };
}

/** 판정: 2.1.0 이미지로 만든 컨테이너가 실행 중이고, 호스트 8080을 실제로 그 컨테이너가 잡고 있다. */
function serving210(state: SystemState): boolean {
  const docker = state.docker;
  const image = docker?.images.find(i => i.repository === "shop-api" && i.tag === "2.1.0");
  const owner = portOwner(state, "0.0.0.0", 8080);
  const forwarder = state.processes.find(p => p.pid === owner?.pid)?.container;
  const container = docker?.containers.find(c => c.id === forwarder);
  return !!image && !!container && container.imageId === image.id && containerView(container, state.clock).status === "running";
}

export const dockerPortAllocated: Scenario = {
  id: "docker-port-allocated",
  title: "배포 완료라는데 옛 버전이 그대로예요",
  category: "docker",
  difficulty: 2,
  ticket: [
    "오늘 08:40에 shop-api 2.1.0 배포 완료 알림(deploy finished: 2.1.0)을 받았습니다.",
    "그런데 2.1.0의 새 기능인 쿠폰 목록이 열리지 않고, 2.1.0에서 고친 장바구니 금액 오류 문의도 계속 들어옵니다.",
    "API는 app-01 서버의 8080 포트에서 컨테이너로 돌고 있습니다. 배포 스크립트는 /opt/deploy, 배포 로그는 /var/log/deploy에 있습니다.",
  ].join("\n"),
  learningObjectives: [
    "\"배포 완료\" 알림을 믿지 않고 실제로 응답하는 버전을 직접 확인한다",
    "docker ps와 docker ps -a의 차이로 시작하지 못한(Created) 컨테이너를 찾는다",
    "port is already allocated가 무엇을 뜻하는지, 누가 포트를 잡고 있는지 확인하고 교체 순서를 바로잡는다",
  ],
  host: "docker-host",
  commands: withCommands("docker", "curl", "ss", "ps"),
  faults: [(state) => {
    const old = state.clock - 9 * DAY;
    const deploy = state.clock - 35 * 60_000;
    addImage(state, shopApi("2.0.3", state.clock - 20 * DAY, {}));
    addImage(state, shopApi("2.1.0", state.clock - DAY, { "/api/coupons": '{"coupons":[{"code":"WELCOME10","discount":10}]}' }));
    const restart = { name: "unless-stopped" as const, maximumRetryCount: 0 };
    const ports = [{ hostIp: "", hostPort: 8080, containerPort: 8080, proto: "tcp" as const }];
    const previous = createContainer(state, { name: "shop-api-2.0.3", image: "shop-api:2.0.3", env: ENV, ports, restart, createdAt: old });
    if (previous.ok) startContainer(state, previous.container, old);
    // 장애: 스크립트가 옛 컨테이너를 멈추지 않고 새 컨테이너를 같은 포트로 띄웠다. 오류 문장은 엔진이 계산한 그대로 로그에 남긴다.
    const next = createContainer(state, { name: "shop-api-2.1.0", image: "shop-api:2.1.0", env: ENV, ports, restart, createdAt: deploy });
    const started = next.ok ? startContainer(state, next.container, deploy) : { ok: true as const };
    const error = started.ok ? "" : started.error;
    writeFile(state.fs, "/opt/deploy/deploy.sh", { mode: 0o755, mtime: state.clock - 30 * DAY, content: [
      "#!/bin/bash", "# usage: deploy.sh VERSION", "VERSION=$1", "",
      "echo \"$(date '+%F %T') deploy start: $VERSION\"",
      "docker load -i /opt/deploy/images/shop-api-$VERSION.tar",
      "docker run -d --name shop-api-$VERSION --restart unless-stopped -p 8080:8080 \\",
      "  --env-file /opt/shop-api/shop-api.env shop-api:$VERSION",
      "echo \"deploy finished: $VERSION\"",
      "curl -fsS -X POST https://hooks.example.com/deploy -d \"shop-api $VERSION\"",
    ].join("\n") });
    writeFile(state.fs, "/opt/shop-api/shop-api.env", { mode: 0o600, owner: "ubuntu", mtime: old, content: Object.entries(ENV).map(([k, v]) => `${k}=${v}`).join("\n") });
    writeFile(state.fs, "/var/log/deploy/shop-api.log", { mtime: deploy, content: [
      "2026-09-02 09:14:58 deploy start: 2.0.3", "Loaded image: shop-api:2.0.3", previous.ok ? previous.container.id : "", "deploy finished: 2.0.3",
      "2026-09-11 08:39:56 deploy start: 2.1.0", "Loaded image: shop-api:2.1.0",
      `docker: Error response from daemon: ${error}.`, "See 'docker run --help'.", "deploy finished: 2.1.0",
    ].join("\n") });
  }],
  rootCause: {
    answerId: "old-container-holds-port",
    choices: [
      { id: "old-container-holds-port", label: "옛 컨테이너(2.0.3)가 8080을 계속 잡고 있어 새 컨테이너(2.1.0)가 시작하지 못했고, 배포 스크립트가 그 실패를 무시했다" },
      { id: "cache", label: "브라우저·CDN 캐시에 옛 화면이 남아 있다",
        whyWrong: "서버 안에서 `curl -s localhost:8080/version`을 해도 2.0.3이 답합니다. 캐시가 아니라 지금 8080에서 2.0.3이 실제로 응답하고 있습니다." },
      { id: "image-missing", label: "2.1.0 이미지를 받지 못해 배포가 실패했다",
        whyWrong: "`docker images`에 shop-api 2.1.0이 있고, 배포 로그에도 Loaded image: shop-api:2.1.0이 남아 있습니다." },
      { id: "crash", label: "2.1.0 컨테이너가 시작하자마자 오류로 종료됐다",
        whyWrong: "`docker ps -a`에서 shop-api-2.1.0은 Exited가 아니라 Created입니다. 한 번도 실행되지 않아 `docker logs shop-api-2.1.0`도 비어 있습니다." },
      { id: "firewall", label: "방화벽(ufw)이 8080 요청을 막는다",
        whyWrong: "요청은 막히지 않고 응답이 옵니다. 다만 2.0.3이 답할 뿐입니다. 방화벽은 어느 버전이 답할지를 정하지 않습니다." },
    ],
  },
  hints: [
    "알림이 아니라 서버가 실제로 무엇을 답하는지 직접 확인해 볼 수 있지 않을까요? 지금 돌고 있는 것과 만들어만 진 것은 다를 수 있어요.",
    "`curl -s localhost:8080/version`, `docker ps`와 `docker ps -a`를 비교하고, `/var/log/deploy/shop-api.log`와 `ss -tlnp`를 보세요.",
    "로그에 port is already allocated가 있고 8080은 shop-api-2.0.3이 잡고 있네요. `docker stop shop-api-2.0.3` 뒤 `docker start shop-api-2.1.0`으로 교체하세요.",
  ],
  resolution: serving210,
  solutionPath: [
    "curl -s localhost:8080/version",
    "docker ps",
    "docker ps -a",
    "cat /var/log/deploy/shop-api.log",
    "docker inspect -f '{{.State.Status}} {{.State.Error}}' shop-api-2.1.0",
    "ss -tlnp",
    "cat /opt/deploy/deploy.sh",
    "docker stop shop-api-2.0.3",
    "docker start shop-api-2.1.0",
    "curl -s localhost:8080/version",
  ],
  postmortem: {
    whatHappened: "08:40 배포 스크립트가 shop-api 2.1.0 컨테이너를 같은 호스트 포트 8080으로 띄우려 했지만, 2.0.3 컨테이너(docker-proxy)가 8080을 잡고 있어 시작에 실패했습니다(port is already allocated). 새 컨테이너는 Created로 남았고, 사용자는 계속 2.0.3의 응답을 받았습니다.",
    whyItHappened: "스크립트가 버전마다 새 이름으로 docker run만 하고 옛 컨테이너를 멈추지 않았습니다. set -e나 종료 코드 검사가 없어 docker run이 실패(종료 코드 125)해도 \"deploy finished\"를 출력하고 알림을 보냈습니다.",
    howToFix: "`docker stop shop-api-2.0.3`으로 옛 컨테이너를 멈춰 8080을 비운 뒤 `docker start shop-api-2.1.0`으로 새 컨테이너를 시작하고, `curl -s localhost:8080/version`으로 2.1.0이 답하는지 확인합니다. 문제가 생기면 반대로 2.1.0을 멈추고 2.0.3을 시작해 되돌릴 수 있도록 옛 컨테이너는 바로 지우지 않습니다.",
    howToPrevent: [
      "1) 배포 스크립트에 set -euo pipefail을 두고, 각 단계의 실패가 곧 배포 실패가 되게 합니다.",
      "2) 배포 완료 판단은 \"명령이 끝났다\"가 아니라 /version·헬스 체크가 새 버전을 답하는지로 합니다.",
      "3) 교체 순서(옛 것 정지 → 새 것 시작 → 확인 → 실패 시 되돌리기)를 스크립트에 넣거나, 다른 호스트 포트로 띄운 뒤 프록시를 바꾸는 방식으로 무중단 교체합니다.",
    ].join("\n"),
    realWorldNote: "docker run은 컨테이너를 만든 다음 시작합니다. 시작이 실패하면 컨테이너는 Created로 남아 docker ps에는 보이지 않고 docker ps -a에만 보입니다. 포트 공개(-p)는 기본적으로 docker-proxy 프로세스가 호스트 포트를 잡으므로 ss -tlnp에 docker-proxy로 보입니다. 이 실습은 docker 명령의 일부 옵션만 지원하며 이미지 받기·네트워크·볼륨은 재현하지 않습니다.",
  },
  evidence: [
    { kind: "official-doc", title: "Docker — docker container run: Publish or expose port (-p, --expose)", url: "https://docs.docker.com/reference/cli/docker/container/run/#publish" },
    { kind: "official-doc", title: "Docker — Port publishing and mapping", url: "https://docs.docker.com/engine/network/port-publishing/" },
    { kind: "official-doc", title: "GNU Bash manual — The Set Builtin (set -e)", url: "https://www.gnu.org/software/bash/manual/html_node/The-Set-Builtin.html" },
  ],
};
