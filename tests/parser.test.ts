import { describe, expect, it } from "vitest";
import { flagValue, hasFlag, parse, positionals, tokenize } from "../src/engine/parser/parse";

describe("tokenize", () => {
  it("공백으로 나눈다", () => {
    expect(tokenize("ls -l /var/log")).toEqual(["ls", "-l", "/var/log"]);
  });

  it("따옴표 안의 공백은 유지한다", () => {
    expect(tokenize('cat "/var/log/my app.log"')).toEqual(["cat", "/var/log/my app.log"]);
    expect(tokenize("echo 'hello world'")).toEqual(["echo", "hello world"]);
  });

  it("연속된 공백을 무시한다", () => {
    expect(tokenize("  df   -h  ")).toEqual(["df", "-h"]);
  });
});

describe("parse", () => {
  it("명령어와 인자를 나눈다", () => {
    const parsed = parse("du -sh /var/log");
    expect(parsed.name).toBe("du");
    expect(parsed.tokens).toEqual(["-sh", "/var/log"]);
    expect(parsed.sudo).toBe(false);
  });

  it("sudo를 떼어낸다", () => {
    const parsed = parse("sudo systemctl restart nginx");
    expect(parsed.sudo).toBe(true);
    expect(parsed.name).toBe("systemctl");
    expect(parsed.tokens).toEqual(["restart", "nginx"]);
  });

  it("리다이렉션을 인식한다", () => {
    expect(parse("df -h > /tmp/out.txt").redirect).toEqual({ path: "/tmp/out.txt", append: false });
    expect(parse("df -h >> /tmp/out.txt").redirect).toEqual({ path: "/tmp/out.txt", append: true });
    // 붙여 쓴 형태도 지원
    expect(parse("df >/tmp/out.txt").redirect).toEqual({ path: "/tmp/out.txt", append: false });
  });

  it("명령어 없이 리다이렉션만 쓰면 이름이 비어 있다 (파일 비우기)", () => {
    const parsed = parse("> /var/log/app.log");
    expect(parsed.name).toBe("");
    expect(parsed.redirect?.path).toBe("/var/log/app.log");
  });
});

describe("플래그 헬퍼", () => {
  it("뭉쳐 쓴 짧은 플래그를 인식한다", () => {
    expect(hasFlag(["-sh"], "s")).toBe(true);
    expect(hasFlag(["-sh"], "h")).toBe(true);
    expect(hasFlag(["-sh"], "l")).toBe(false);
  });

  it("긴 플래그를 인식한다", () => {
    expect(hasFlag(["--human-readable"], "h", "human-readable")).toBe(true);
  });

  it("플래그 값을 여러 형태로 읽는다", () => {
    expect(flagValue(["-n", "20"], "n", "lines")).toBe("20");
    expect(flagValue(["-n20"], "n", "lines")).toBe("20");
    expect(flagValue(["--lines=20"], "n", "lines")).toBe("20");
    expect(flagValue(["-u", "nginx"], "u", "unit")).toBe("nginx");
  });

  it("플래그 값은 인자로 세지 않는다", () => {
    expect(positionals(["-n", "20", "/var/log/syslog"], ["n", "lines"])).toEqual(["/var/log/syslog"]);
    expect(positionals(["-sh", "/var/log"])).toEqual(["/var/log"]);
  });
});
