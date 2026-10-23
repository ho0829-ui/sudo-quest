/**
 * 열린 파일 수 한도·/proc·systemd unit·셸 도구(echo·tee·mkdir·ulimit·lsof). 출력은 상태에서 계산된다.
 */
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { parseNofile } from "../src/engine/state/systemdUnits";
import type { SystemState } from "../src/engine/state/types";
import { linuxTooManyFiles } from "../src/scenarios/linux-too-many-files";

const available = linuxTooManyFiles.commands;
const DROP_IN = "/etc/systemd/system/shop-api.service.d";

function session(state: SystemState = buildInitialState(linuxTooManyFiles)) {
  let current = state;
  return (line: string) => {
    const result = runCommand(current, line, { available });
    current = result.state;
    return result;
  };
}

describe("unit 파일의 LimitNOFILE", () => {
  it.each([
    ["[Service]\nLimitNOFILE=4096", { soft: 4096, hard: 4096 }],
    ["[Service]\nLimitNOFILE=1024:524288", { soft: 1024, hard: 524288 }],
    ["[Service]\nLimitNOFILE=infinity", { soft: 1048576, hard: 1048576 }],
    ["[Unit]\nLimitNOFILE=4096", undefined],
    ["[Service]\nLimitNOFILE=lots", undefined],
  ])("%s", (content, expected) => expect(parseNofile([{ content }])).toEqual(expected));

  it("drop-in이 본 파일 값을 덮는다", () => {
    expect(parseNofile([{ content: "[Service]\nLimitNOFILE=2048" }, { content: "[Service]\nLimitNOFILE=65535" }])).toEqual({ soft: 65535, hard: 65535 });
  });
});

describe("/proc과 fd 한도", () => {
  it("limits·fd·file-nr은 계산되고, fd 목록은 root만 본다", () => {
    const run = session();
    expect(run("cat /proc/1340/limits").stdout).toMatch(/^Max open files +1024 +524288 +files$/m);
    expect(run("ls /proc/1340/fd").stderr).toBe("ls: cannot open directory '/proc/1340/fd': Permission denied");
    expect(run("sudo ls /proc/1340/fd | wc -l").stdout).toBe("1024");
    expect(run("sudo ls -l /proc/1340/fd | head -n 2").stdout).toMatch(/total \d+\nlrwx------ +1 root root +64 .* 0 -> \/dev\/null$/);
    expect(run("cat /proc/sys/fs/file-nr").stdout).toMatch(/^\d+\t0\t9223372036854775807$/);
    expect(run("cat /proc/99999/limits").stderr).toBe("cat: /proc/99999/limits: No such file or directory");
  });

  it("한도에 막힌 프로세스는 요청을 받지 못해 curl이 시간 초과(28)된다", () => {
    const result = session()("curl -m 5 -s localhost:3000/health");
    expect(result.exitCode).toBe(28);
    expect(result.stderr).toBe("curl: (28) Operation timed out after 5001 milliseconds with 0 bytes received");
  });

  it("lsof는 같은 fd 목록을 보여 주고, 일반 사용자에게는 Permission denied 줄만 보인다", () => {
    const run = session();
    expect(run("sudo lsof -i :3000 | grep -c ESTABLISHED").stdout).toBe("1000");
    expect(run("sudo lsof -i :3000 | grep LISTEN").stdout).toMatch(/node +1340 root +23u IPv4 .* TCP \*:3000 \(LISTEN\)$/);
    expect(run("lsof -p 1340").stdout).toContain("/proc/1340/fd (opendir: Permission denied)");
    expect(run("lsof -x").stderr).toMatch(/^lsof: unsupported option: -x/);
  });
});

describe("ls는 파이프로 보낼 때 한 줄에 하나씩", () => {
  it("터미널이면 두 칸 띄어 한 줄, 파이프·파일이면 줄마다", () => {
    const run = session();
    expect(run("ls /opt/app").stdout).not.toContain("\n");
    expect(run("ls /etc/security | wc -l").stdout).toBe("1");
    expect(Number(run("ls /etc | wc -l").stdout)).toBeGreaterThan(1);
  });
});

describe("셸 도구", () => {
  it("echo는 -e일 때만 \\n을 해석하고, -n·알 수 없는 옵션은 bash처럼 다룬다", () => {
    const run = session();
    expect(run("echo -e 'a\\nb'").stdout).toBe("a\nb");
    expect(run("echo 'a\\nb'").stdout).toBe("a\\nb");
    expect(run("echo -x hi").stdout).toBe("-x hi");
  });

  it("tee는 권한·디렉터리를 검사하고 -a로 이어 쓴다", () => {
    const run = session();
    expect(run("echo x | tee /etc/x.conf").stderr).toBe("tee: /etc/x.conf: Permission denied");
    expect(run("echo x | sudo tee /etc/nope/x.conf").stderr).toBe("tee: /etc/nope/x.conf: No such file or directory");
    run("echo one | tee /home/ubuntu/note.txt");
    run("echo two | tee -a /home/ubuntu/note.txt");
    expect(run("cat /home/ubuntu/note.txt").stdout).toBe("one\ntwo");
  });

  it("mkdir는 -p 없이 상위가 없거나 이미 있으면 실패하고, 권한 없는 곳에는 만들지 못한다", () => {
    const run = session();
    expect(run(`mkdir ${DROP_IN}`).stderr).toBe(`mkdir: cannot create directory ‘${DROP_IN}’: Permission denied`);
    expect(run("sudo mkdir /etc/a/b").stderr).toBe("mkdir: cannot create directory ‘/etc/a/b’: No such file or directory");
    expect(run("sudo mkdir -p /etc/a/b").exitCode).toBe(0);
    expect(run("sudo mkdir /etc/a/b").stderr).toBe("mkdir: cannot create directory ‘/etc/a/b’: File exists");
    expect(run("sudo mkdir -p /etc/a/b").exitCode).toBe(0);
  });

  it("ulimit는 로그인 셸 한도(limits.conf)를 보여 주고, 바꿔도 서비스에는 영향이 없다", () => {
    const run = session();
    expect(run("ulimit -n").stdout).toBe("65535");
    expect(run("ulimit -Hn").stdout).toBe("65535");
    expect(run("ulimit -n 2048").exitCode).toBe(0);
    expect(run("ulimit -n").stdout).toBe("2048");
    expect(run("cat /proc/1340/limits | grep 'open files'").stdout).toContain("1024");
    expect(run("ulimit -n lots").stderr).toBe("bash: ulimit: lots: invalid number");
    expect(run("sudo ulimit -n 4096").stderr).toBe("sudo: ulimit: command not found");
  });
});

describe("systemctl unit 설정 반영", () => {
  it("daemon-reload 전에는 경고와 함께 옛 한도로 시작하고, reload 뒤에 새 한도가 적용된다", () => {
    const run = session();
    expect(run("systemctl daemon-reload").stderr).toBe("Failed to reload daemon: Access denied");
    run(`sudo mkdir -p ${DROP_IN}`);
    run(`echo -e '[Service]\\nLimitNOFILE=4096:8192' | sudo tee ${DROP_IN}/override.conf`);
    expect(run("systemctl show shop-api -p NeedDaemonReload").stdout).toBe("NeedDaemonReload=yes");
    expect(run("systemctl cat shop-api").stdout).toContain(`# ${DROP_IN}/override.conf\n[Service]\nLimitNOFILE=4096:8192`);
    run("sudo systemctl daemon-reload");
    expect(run("systemctl show shop-api -p LimitNOFILE,LimitNOFILESoft,DropInPaths").stdout)
      .toBe(`LimitNOFILE=8192\nLimitNOFILESoft=4096\nDropInPaths=${DROP_IN}/override.conf`);
    run("sudo systemctl restart shop-api");
    const pid = run("systemctl show shop-api -p MainPID").stdout.split("=")[1];
    expect(run(`cat /proc/${pid}/limits`).stdout).toMatch(/^Max open files +4096 +8192 +files$/m);
    expect(run("curl -s localhost:3000/health").stdout).toBe('{"status":"ok"}');
    expect(run("systemctl cat nginx").stderr).toBe("No files found for nginx.service.");
  });
});
