/**
 * "정상"인 우분투 웹 서버 프리셋.
 *
 * 시나리오는 이 정상 상태에서 출발해서, 필요한 부분만 망가뜨린다(fault).
 * 그래야 시나리오 파일마다 서버 전체를 다시 적지 않아도 된다.
 */
import { ensureDir, writeFile } from "../fs";
import type { DirNode, SystemState } from "../types";

/** 시뮬레이션 기준 시각: 2026-09-11 09:15:00 UTC (장애 신고가 들어온 오전) */
export const BASE_CLOCK = Date.UTC(2026, 8, 11, 9, 15, 0);

const GB = 1024 * 1024; // KB 단위 기준

export function ubuntuWeb(): SystemState {
  const root: DirNode = {
    kind: "dir",
    name: "/",
    owner: "root",
    group: "root",
    mode: 0o755,
    mtime: BASE_CLOCK,
    children: [],
  };

  // 기본 디렉터리
  for (const dir of ["/etc", "/var/log", "/var/www/html", "/home/ubuntu", "/opt/app"]) {
    ensureDir(root, dir);
  }

  // 홈 디렉터리는 로그인 사용자 소유여야 한다. (여기서 파일을 만들 수 있어야 하므로)
  const home = ensureDir(root, "/home/ubuntu");
  home.owner = "ubuntu";
  home.group = "ubuntu";

  writeFile(root, "/etc/hostname", { content: "web-01\n", mtime: BASE_CLOCK - 86400_000 * 30 });
  writeFile(root, "/etc/resolv.conf", {
    content: "nameserver 10.0.0.2\nsearch ap-northeast-2.compute.internal\n",
    mtime: BASE_CLOCK - 86400_000 * 30,
  });
  writeFile(root, "/var/www/html/index.html", {
    content: "<!doctype html>\n<html><body><h1>Shop Service</h1></body></html>\n",
    owner: "www-data",
    group: "www-data",
    mtime: BASE_CLOCK - 86400_000 * 3,
  });

  // 평소에도 쌓여 있는 정상 로그들. 원인과 무관한 출력도 섞여야 현실감이 있다.
  writeFile(root, "/var/log/syslog", {
    sizeKB: 4_200,
    content: [
      "Sep 11 08:00:01 web-01 CRON[2011]: (root) CMD (/usr/local/bin/backup.sh)",
      "Sep 11 08:17:01 web-01 CRON[2104]: (root) CMD (cd / && run-parts --report /etc/cron.hourly)",
      "Sep 11 09:01:44 web-01 systemd[1]: Started Daily apt download activities.",
    ].join("\n") + "\n",
    mtime: BASE_CLOCK - 600_000,
  });
  writeFile(root, "/var/log/auth.log", {
    sizeKB: 880,
    content: [
      "Sep 11 07:42:10 web-01 sshd[1802]: Accepted publickey for ubuntu from 10.0.1.55 port 51234 ssh2",
      "Sep 11 08:55:03 web-01 sudo:  ubuntu : TTY=pts/0 ; PWD=/home/ubuntu ; USER=root ; COMMAND=/usr/bin/apt update",
    ].join("\n") + "\n",
    mtime: BASE_CLOCK - 1_200_000,
  });
  writeFile(root, "/var/log/nginx/access.log", {
    sizeKB: 12_500,
    content: [
      '10.0.1.20 - - [11/Sep/2026:08:59:12 +0000] "GET / HTTP/1.1" 200 612 "-" "Mozilla/5.0"',
      '10.0.1.33 - - [11/Sep/2026:08:59:40 +0000] "GET /health HTTP/1.1" 200 2 "-" "ELB-HealthChecker/2.0"',
    ].join("\n") + "\n",
    mtime: BASE_CLOCK - 900_000,
  });
  writeFile(root, "/var/log/nginx/error.log", {
    sizeKB: 64,
    content: "",
    mtime: BASE_CLOCK - 900_000,
  });

  return {
    hostname: "web-01",
    clock: BASE_CLOCK,
    user: "ubuntu",
    cwd: "/home/ubuntu",
    fs: root,
    disks: [
      // 8GB 루트 디스크. 2.1GB는 OS와 패키지가 이미 쓰고 있다.
      { device: "/dev/root", mount: "/", totalKB: 8 * GB, reservedKB: 2.1 * GB },
    ],
    memory: { totalKB: 2 * GB, reservedKB: 380 * 1024 },
    services: [
      {
        name: "nginx",
        description: "A high performance web server and a reverse proxy server",
        state: "active",
        enabled: true,
        unitPath: "/lib/systemd/system/nginx.service",
        execStart: "/usr/sbin/nginx -g daemon on; master_process on;",
        mainPid: 1102,
        since: BASE_CLOCK - 86400_000 * 6,
        listenPorts: [
          { addr: "0.0.0.0", port: 80 },
          { addr: "0.0.0.0", port: 443 },
        ],
        // nginx는 로그를 쓰지 못하면 시작에 실패한다. 여유 공간이 이만큼은 있어야 한다.
        requiresFreeKB: 20 * 1024,
        memKB: 42 * 1024,
        cpu: 0.3,
      },
      {
        name: "shop-api",
        description: "Shop backend API (Node.js)",
        state: "active",
        enabled: true,
        unitPath: "/etc/systemd/system/shop-api.service",
        execStart: "/usr/bin/node /opt/app/server.js",
        mainPid: 1340,
        since: BASE_CLOCK - 86400_000 * 6,
        listenPorts: [{ addr: "127.0.0.1", port: 3000 }],
        requiresFreeKB: 10 * 1024,
        memKB: 210 * 1024,
        cpu: 1.4,
      },
    ],
    processes: [
      { pid: 1, user: "root", cpu: 0, memKB: 12 * 1024, command: "/sbin/init" },
      { pid: 812, user: "root", cpu: 0, memKB: 9 * 1024, command: "/usr/sbin/sshd -D", listenPorts: [{ addr: "0.0.0.0", port: 22 }] },
      {
        pid: 1102,
        user: "root",
        cpu: 0.3,
        memKB: 42 * 1024,
        command: "/usr/sbin/nginx -g daemon on; master_process on;",
        listenPorts: [
          { addr: "0.0.0.0", port: 80 },
          { addr: "0.0.0.0", port: 443 },
        ],
        service: "nginx",
      },
      {
        pid: 1340,
        user: "root",
        cpu: 1.4,
        memKB: 210 * 1024,
        command: "/usr/bin/node /opt/app/server.js",
        listenPorts: [{ addr: "127.0.0.1", port: 3000 }],
        service: "shop-api",
      },
    ],
    journal: [
      { time: BASE_CLOCK - 4500_000, tag: "systemd", priority: "info", message: "Started Daily apt download activities." },
      { time: BASE_CLOCK - 3600_000, tag: "CRON", pid: 2104, priority: "info", message: "(root) CMD (cd / && run-parts --report /etc/cron.hourly)" },
    ],
  };
}

export const hostPresets = {
  "ubuntu-web": ubuntuWeb,
};

export type HostPreset = keyof typeof hostPresets;
