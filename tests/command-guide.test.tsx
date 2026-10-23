/**
 * 미지원 명령 안내: 대응표가 정확한지(정말 미지원인지, 대안은 실제 명령인지), 마지막 미지원 명령 찾기, 펼침 안내 렌더링.
 */
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getCommand } from "../src/engine/commands";
import { DEFAULT_COMMANDS } from "../src/engine/commands/names";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { scenarios } from "../src/scenarios";
import { CommandGuide } from "../src/ui/components/CommandGuide";
import { lastUnknownCommand, UNSUPPORTED_COMMANDS, unsupportedEntry, usableAlternatives } from "../src/ui/unsupportedCommands";

const line = (input: string, stderr = "", exitCode = 0) => ({ input, stderr, exitCode });

describe("미지원 명령 대응표", () => {
  it("표에 있는 명령은 정말로 엔진에 없고, 이름이 겹치지 않는다", () => {
    const names = UNSUPPORTED_COMMANDS.flatMap(e => e.names);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(getCommand(name), name).toBeUndefined();
  });

  it("대안의 첫 단어(sudo 제외)는 실제로 있는 명령이고, 대안이 없으면 이유가 적혀 있다", () => {
    for (const entry of UNSUPPORTED_COMMANDS) {
      expect(entry.purpose.trim()).not.toBe("");
      if (!entry.instead.length) expect(entry.note?.trim()).toBeTruthy();
      for (const alt of entry.instead) {
        const words = alt.command.split(/\s+/);
        expect(getCommand(words[0] === "sudo" ? words[1] : words[0]), alt.command).toBeDefined();
      }
    }
  });

  it("이 실습에서 쓸 수 없는 대안은 숨긴다", () => {
    const netstat = unsupportedEntry("netstat")!;
    expect(usableAlternatives(netstat, ["ss", "ls"]).map(a => a.command)).toEqual(["ss -tlnp"]);
    expect(usableAlternatives(netstat, DEFAULT_COMMANDS)).toEqual([]);
    expect(usableAlternatives(unsupportedEntry("service")!, ["systemctl"])).toHaveLength(2);
  });
});

describe("터미널 출력은 실제 셸처럼", () => {
  it("모르는 명령은 bash:, sudo로 부르면 sudo: 접두사", () => {
    const state = buildInitialState(scenarios[0]);
    expect(runCommand(state, "netstat -tlnp").stderr).toBe("bash: netstat: command not found");
    expect(runCommand(state, "sudo vim /etc/hosts").stderr).toBe("sudo: vim: command not found");
  });

  it("마지막으로 친 명령이 미지원이었는지 찾는다(빈 줄은 건너뛰고, 다른 오류는 무시)", () => {
    expect(lastUnknownCommand([line("df -h"), line("netstat -tlnp", "bash: netstat: command not found", 127)])).toBe("netstat");
    expect(lastUnknownCommand([line("sudo top", "sudo: top: command not found", 127), line("  ")])).toBe("top");
    expect(lastUnknownCommand([line("netstat", "bash: netstat: command not found", 127), line("ls")])).toBeNull();
    expect(lastUnknownCommand([line("cat /nope", "cat: /nope: No such file or directory", 1)])).toBeNull();
    expect(lastUnknownCommand([])).toBeNull();
  });
});

describe("명령어 안내(펼침)", () => {
  const available = ["ls", "cat", "ss", "systemctl", "help"];

  it("평소에는 이 실습의 명령 수와 안내 제목을 보여 주고, 쓸 수 있는 명령의 사용법을 담는다", () => {
    const html = renderToStaticMarkup(<CommandGuide available={available} lines={[]} />);
    expect(html).toContain("쓸 수 있는 명령 5개");
    expect(html).toContain(getCommand("ss")!.usage.replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    expect(html).toContain("자주 찾는데 여기서는 안 되는 명령");
  });

  it("방금 친 미지원 명령을 제목에 띄우고, 이 실습에서 쓸 수 있는 대안을 보여 준다", () => {
    const html = renderToStaticMarkup(<CommandGuide available={available} lines={[line("netstat -tlnp", "bash: netstat: command not found", 127)]} />);
    expect(html).toContain("has-unknown");
    expect(html).toContain("<code>netstat</code>은(는) 이 실습에서 지원하지 않아요");
    expect(html).toContain("ss -tlnp");
  });

  it("다른 실습에만 있는 명령이면 그렇게 알려 준다", () => {
    const html = renderToStaticMarkup(<CommandGuide available={available} lines={[line("kubectl get pods", "bash: kubectl: command not found", 127)]} />);
    expect(html).toContain("다른 실습에서는 쓰지만 이 실습에서는 열려 있지 않은 명령");
  });
});
