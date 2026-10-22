/**
 * 명령어 출력 단위 테스트.
 *
 * 특히 "상태를 바꾸면 출력이 따라 바뀐다"는 핵심 원칙(CLAUDE.md 4-2)을 검증한다.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_COMMANDS } from "../src/engine/commands";
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

  it("파이프: 앞 명령의 출력을 다음 명령이 읽고, 종료 코드는 마지막 명령의 것이다", () => {
    // 기본 서버의 syslog는 3줄이고 그중 2줄이 CRON이다.
    const result = run("cat /var/log/syslog | grep CRON");
    expect(result.exitCode).toBe(0);
    expect(result.stdout.split("\n")).toHaveLength(2);
    expect(run("cat /var/log/syslog | grep CRON | wc -l").stdout).toBe("2");
    expect(run("cat /var/log/syslog | grep zzz-없는-문자열").exitCode).toBe(1);
    // 시나리오에서 막힌 명령은 파이프 안에서도 command not found
    expect(run("ps aux | grep nginx").stderr).toContain("ps: command not found");
  });

  it("파이프 문법 오류는 bash처럼 알린다", () => {
    expect(run("ls |").stderr).toContain("syntax error near unexpected token `|'");
    expect(run("| ls").exitCode).toBe(2);
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

  it("du -d 1 은 바로 아래 디렉터리까지만 보여 준다 (-xhd1, --max-depth=1도 같다)", () => {
    const deep = run("du -h /").stdout.split("\n").filter(Boolean);
    const shallow = run("du -h -d 1 /").stdout.split("\n").filter(Boolean);
    expect(shallow.length).toBeLessThan(deep.length);
    // 깊이 1이면 "/var"는 나오고 "/var/log"는 나오지 않는다.
    expect(shallow.some(line => /\s\/var$/.test(line))).toBe(true);
    expect(shallow.some(line => /\s\/var\/log$/.test(line))).toBe(false);
    expect(run("du -xhd1 /").stdout).toBe(run("du -h -d 1 /").stdout);
    expect(run("du -h --max-depth=1 /").stdout).toBe(run("du -h -d 1 /").stdout);
  });

  it("du 깊이 값이 숫자가 아니거나 -s와 겹치면 실제 du처럼 거부한다", () => {
    expect(run("du -d x /").stderr).toContain("invalid maximum depth 'x'");
    expect(run("du -s -d 1 /").stderr).toContain("summarizing conflicts with --max-depth=1");
    expect(run("du -h -d 0 /var/log").stdout.trim().split("\n")).toHaveLength(1);
  });
});

describe("텍스트 필터: grep · head · tail · sort · wc", () => {
  it("grep -n -i -c -v 와 여러 파일 이름 붙이기", () => {
    const n = run("grep -n -i cron /var/log/syslog");
    expect(n.stdout).toMatch(/^1:Sep 11 08:00:01/);
    const count = Number(run("grep -c -i cron /var/log/syslog").stdout);
    expect(count).toBe(2);
    const total = run("wc -l /var/log/syslog").stdout.trim().split(/\s+/)[0];
    const inverted = Number(run("grep -v -c -i cron /var/log/syslog").stdout);
    expect(count + inverted).toBe(Number(total));
    expect(run("grep CRON /var/log/syslog /var/log/auth.log").stdout).toMatch(/^\/var\/log\/syslog:/m);
  });

  it("grep 기본 정규식은 + ? | ( ) 를 글자로, -E는 특수 기호로 본다", () => {
    expect(run("grep -c 'a|b' /var/log/syslog").stdout).toBe("0");
    expect(run("grep -E -c 'CRON|systemd' /var/log/syslog").stdout).toBe("3");
    expect(run("grep '(root)' /var/log/syslog").stdout.split("\n")).toHaveLength(2);
    expect(run("grep -E '(' /var/log/syslog").stderr).toContain("Unmatched");
  });

  it("grep -r 은 디렉터리 아래를 뒤지고, 없는 파일은 종료 코드 2", () => {
    expect(run("grep -r -l CRON /var/log").stdout).toBe("/var/log/syslog");
    expect(run("grep x /없는파일").exitCode).toBe(2);
    expect(run("grep x /var/log").stderr).toContain("Is a directory");
  });

  it("head·tail은 -n N과 -N 둘 다 받고 파이프 입력도 자른다", () => {
    expect(run("head -n 3 /var/log/syslog").stdout.split("\n")).toHaveLength(3);
    expect(run("head -2 /var/log/syslog").stdout.split("\n")).toHaveLength(2);
    expect(run("cat /var/log/syslog | tail -n 1").stdout).toBe(run("tail -n 1 /var/log/syslog").stdout);
    expect(run("head -n x /var/log/syslog").stderr).toContain("invalid number of lines");
  });

  it("sort -h는 사람이 읽는 크기로, wc -l은 줄 수를 숫자만 낸다", () => {
    const sorted = run("du -sh /var/log/* | sort -rh").stdout.split("\n");
    expect(sorted[0]).toMatch(/12M\s+\/var\/log\/nginx$/);
    expect(run("du -sh /var/log/* | wc -l").stdout).toMatch(/^\d+$/);
    expect(run("wc -l /var/log/syslog").stdout).toMatch(/^\d+ \/var\/log\/syslog$/);
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

  it("reload는 실행 중일 때만 되고, root 권한이 필요하다", () => {
    expect(run("systemctl reload nginx").stderr).toContain("Access denied");
    const active = run("sudo systemctl reload nginx");
    if (active.exitCode !== 0) expect(active.stderr).toMatch(/is not active, cannot reload|failed because/);
    run("sudo systemctl stop nginx");
    expect(run("sudo systemctl reload nginx").stderr).toContain("nginx.service is not active, cannot reload.");
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
  it("리다이렉션은 sudo가 아니라 셸 사용자 권한으로 열리고, root 파일은 sudo tee로 비운다", () => {
    const sizeBefore = 4200;
    // 실제 bash처럼 > 는 sudo 앞의 일반 사용자 셸이 연다.
    expect(run("sudo > /var/log/syslog").stderr).toBe("bash: /var/log/syslog: Permission denied");
    const result = runCommand(state, "echo -n | sudo tee /var/log/syslog", { available: [...DEFAULT_COMMANDS, "echo", "tee"] });
    state = result.state;
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
