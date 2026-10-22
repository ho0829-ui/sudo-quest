/**
 * Docker 실습용 호스트: ubuntu-web에서 systemd로 돌던 shop-api를 빼고, dockerd와 컨테이너 하나(상태 페이지)를 둔다.
 * 상태 페이지는 원인과 무관한 정상 컨테이너다. docker ps가 늘 비어 있지 않게 해 현실감을 준다.
 */
import { writeFile } from "../fs";
import { createContainer, startContainer } from "../docker/lifecycle";
import { hexId } from "../docker/format";
import type { SystemState } from "../types";
import { ubuntuWeb } from "./ubuntuWeb";

const DAY = 86_400_000;

export function dockerHost(): SystemState {
  const state = ubuntuWeb();
  state.hostname = "app-01";
  writeFile(state.fs, "/etc/hostname", { content: "app-01\n", mtime: state.clock });
  writeFile(state.fs, "/etc/hosts", { content: "127.0.0.1 localhost\n127.0.1.1 app-01\n", mtime: state.clock });
  // 운영 계정을 docker 그룹에 넣어 sudo 없이 docker를 쓰는 흔한 구성이다.
  writeFile(state.fs, "/etc/group", { content: "root:x:0:\nsudo:x:27:ubuntu\ndocker:x:999:ubuntu\nubuntu:x:1000:\n", mtime: state.clock - 30 * DAY });
  state.services = state.services.filter(s => s.name !== "shop-api");
  state.processes = state.processes.filter(p => p.service !== "shop-api");
  state.services.push({
    name: "docker", description: "Docker Application Container Engine", state: "active", enabled: true,
    unitPath: "/lib/systemd/system/docker.service", execStart: "/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock",
    mainPid: 905, since: state.clock - 6 * DAY, memKB: 78 * 1024, cpu: 0.4,
  });
  state.processes.push(
    { pid: 861, user: "root", cpu: 0.2, memKB: 46 * 1024, command: "/usr/bin/containerd" },
    { pid: 905, user: "root", cpu: 0.4, memKB: 78 * 1024, command: "/usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock", service: "docker" },
  );
  state.docker = {
    images: [{
      repository: "nginx", tag: "1.25-alpine", id: hexId("image:nginx:1.25-alpine"), createdAt: state.clock - 120 * DAY, sizeMB: 43.2,
      cmd: ["nginx", "-g", "daemon off;"], env: { PATH: "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin", NGINX_VERSION: "1.25.5" },
      profile: { ports: [80], paths: ["/"], headers: { Server: "nginx/1.25.5", "Content-Type": "text/html" }, responses: { "/": "<html><body><h1>Status</h1><p>All systems operational</p></body></html>" },
        log: { boot: ["/docker-entrypoint.sh: Configuration complete; ready for start up"], ready: [] } },
    }],
    containers: [],
  };
  const status = createContainer(state.docker, {
    name: "status-page", image: "nginx:1.25-alpine", createdAt: state.clock - 6 * DAY,
    ports: [{ hostIp: "", hostPort: 8081, containerPort: 80, proto: "tcp" }], restart: { name: "unless-stopped", maximumRetryCount: 0 },
  });
  if (status.ok) startContainer(state, status.container, state.clock - 6 * DAY);
  return state;
}
