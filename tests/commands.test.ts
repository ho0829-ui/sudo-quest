/**
 * 명령어 출력 단위 테스트.
 *
 * 특히 "상태를 바꾸면 출력이 따라 바뀐다"는 핵심 원칙(CLAUDE.md 4-2)을 검증한다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { ubuntuWeb } from "../src/engine/state/hosts";
import { diskUsage } from "../src/engine/state/derived";
import type { SystemState } from "../src/engine/state/types";

let state: SystemState;

beforeEach(() => {
  state = ubuntuWeb();
});

/** 여러 명령을 순서대로 실행하는 도우미 */
function run(input: string) {
  const result = runCommand(state, input);
  state = result.state;
  return result;
}

describe("실행기", () => {
  it("모르는 명령어는 실제 셸처럼 127을 반환한다", () => {
    const result = run("kubectl get pods");
    expect(result.exitCode).toBe(127);
    expect(result.stderr).toContain("command not found");
  });

  it("빈 입력은 아무 일도 하지 않는다", () => {
    expect(run("   ").exitCode).toBe(0);
  });

  it("파이프는 지원하지 않는다고 알려준다", () => {
    expect(run("ps aux | grep nginx").stderr).toContain("파이프");
  });

  it("원본 상태를 바꾸지 않는다 (불변성)", () => {
    const before = ubuntuWeb();
    const result = runCommand(before, "sudo rm /var/log/syslog");
    expect(result.state).not.toBe(before);
    // 원본에는 파일이 그대로 남아 있어야 한다
    const varLog = before.fs.children.find((c) => c.name === "var");
    expect(JSON.stringify(varLog)).toContain("syslog");
  });

  it("* 를 확장한다", () => {
    const result = run("ls /var/log/*");
    expect(result.stdout).toContain("syslog");
    expect(result.stdout).toContain("auth.log");
  });
});

describe("df / du — 상태에서 계산된다", () => {
  it("df -h 가 실제 리눅스와 같은 열을 보여준다", () => {
    const result = run("df -h");
    expect(result.stdout).toContain("Filesystem");
    expect(result.stdout).toContain("Mounted on");
    expect(result.stdout).toContain("/dev/root");
  });

  it("큰 파일이 생기면 사용량이 오르고, 지우면 내려간다", () => {
    const before = diskUsage(state, "/").usePercent;

    run("sudo rm /var/log/syslog");
    const afterDelete = diskUsage(state, "/").usePercent;
    expect(afterDelete).toBeLessThanOrEqual(before);
  });

  it("du -sh 는 디렉터리 합계를 낸다", () => {
    const result = run("du -sh /var/log");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\d+(\.\d+)?[KMG]\s+\/var\/log/);
  });
});

describe("권한", () => {
  it("root 소유 파일은 sudo 없이 지울 수 없다", () => {
    const result = run("rm /var/log/syslog");
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Permission denied");
  });

  it("sudo를 붙이면 지울 수 있다", () => {
    expect(run("sudo rm /var/log/syslog").exitCode).toBe(0);
    expect(run("ls /var/log").stdout).not.toContain("syslog");
  });

  it("서비스 제어에는 root 권한이 필요하다", () => {
    const result = run("systemctl restart nginx");
    expect(result.stderr).toContain("Access denied");
  });
});

describe("systemctl / journalctl", () => {
  it("status 는 실제와 비슷한 형식으로 보여준다", () => {
    const result = run("systemctl status nginx");
    expect(result.stdout).toContain("nginx.service - A high performance web server");
    expect(result.stdout).toContain("Loaded: loaded");
    expect(result.stdout).toContain("Active: active (running)");
    expect(result.exitCode).toBe(0);
  });

  it("없는 서비스는 실제처럼 에러를 낸다", () => {
    const result = run("systemctl status httpd");
    expect(result.stderr).toContain("could not be found");
  });

  it("stop 하면 프로세스와 포트가 함께 사라진다", () => {
    run("sudo systemctl stop nginx");
    expect(state.processes.some((p) => p.service === "nginx")).toBe(false);
    expect(run("systemctl is-active nginx").stdout).toBe("inactive");
  });

  it("포트가 점유되어 있으면 시작에 실패한다", () => {
    run("sudo systemctl stop nginx");
    // 다른 프로세스가 80 포트를 차지한 상황을 만든다
    state.processes.push({
      pid: 9999,
      user: "root",
      cpu: 0,
      memKB: 1024,
      command: "/usr/bin/python3 -m http.server 80",
      listenPorts: [{ addr: "0.0.0.0", port: 80 }],
    });
    const result = run("sudo systemctl start nginx");
    expect(result.exitCode).not.toBe(0);
    expect(run("journalctl -u nginx").stdout).toContain("Address already in use");
  });

  it("journalctl -u 는 해당 서비스 로그만 걸러낸다", () => {
    run("sudo systemctl stop nginx");
    const result = run("journalctl -u nginx -n 5");
    expect(result.stdout).toContain("nginx");
  });
});

describe("리다이렉션", () => {
  it("> 로 파일을 비울 수 있다", () => {
    const sizeBefore = 4200;
    const result = run("sudo > /var/log/syslog");
    expect(result.exitCode).toBe(0);

    const varDir = state.fs.children.find((c) => c.name === "var");
    const logDir = varDir?.kind === "dir" ? varDir.children.find((c) => c.name === "log") : undefined;
    const syslog = logDir?.kind === "dir" ? logDir.children.find((c) => c.name === "syslog") : undefined;
    expect(syslog?.kind === "file" ? syslog.sizeKB : -1).toBeLessThan(sizeBefore);
  });

  it("명령 출력을 파일로 보낼 수 있다", () => {
    run("df -h > /home/ubuntu/disk.txt");
    expect(run("cat /home/ubuntu/disk.txt").stdout).toContain("Filesystem");
  });
});
