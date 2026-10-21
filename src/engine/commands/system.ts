/** 시스템 상태를 보는 명령어들: df, du, systemctl, journalctl, help */
import { flagValue, hasFlag, positionals } from "../parser/parse";
import { allDiskUsage, duKB } from "../state/derived";
import { isDir, lookup, walk } from "../state/fs";
import { formatAgo, formatFullTime, formatLogTime, humanKB, table } from "../state/format";
import { formatJournalLine } from "../state/log";
import { findService, startService, stopService } from "../state/services";
import type { Service } from "../state/types";
import { fail, ok, type Command, type CommandContext } from "./types";

export const df: Command = {
  name: "df",
  summary: "디스크 사용량을 본다 (-h 읽기 쉬운 단위)",
  usage: "df [-h]",
  run({ state, tokens }: CommandContext) {
    const human = hasFlag(tokens, "h", "human-readable");
    const fmt = (kb: number) => (human ? humanKB(kb) : String(Math.round(kb)));

    const rows = [["Filesystem", "Size", "Used", "Avail", "Use%", "Mounted on"]];
    for (const usage of allDiskUsage(state)) {
      rows.push([
        usage.disk.device,
        fmt(usage.disk.totalKB),
        fmt(usage.usedKB),
        fmt(usage.availKB),
        `${usage.usePercent}%`,
        usage.disk.mount,
      ]);
    }
    return ok(table(rows, ["left", "right", "right", "right", "right", "left"]));
  },
};

export const du: Command = {
  name: "du",
  summary: "경로별 용량을 본다 (-s 합계만, -h 읽기 쉬운 단위, -d N 깊이 제한)",
  usage: "du [-sh] [-d N] [경로...]",
  run({ state, tokens }: CommandContext) {
    let summarize = hasFlag(tokens, "s");
    const human = hasFlag(tokens, "h");
    const paths = positionals(tokens, ["d", "max-depth"]);
    if (paths.length === 0) paths.push(".");

    // -d N / -dN / -xhd1 / --max-depth=N. 실제 du처럼 숫자가 아니면 거부하고, -s와 함께 쓰면 경고한다.
    const depthText = flagValue(tokens, "d", "max-depth");
    let maxDepth: number | undefined;
    if (depthText !== undefined) {
      if (!/^\d+$/.test(depthText)) return fail(`du: invalid maximum depth '${depthText}'\nTry 'du --help' for more information.`);
      maxDepth = Number(depthText);
      if (summarize && maxDepth !== 0) {
        return fail(`du: warning: summarizing conflicts with --max-depth=${maxDepth}\nTry 'du --help' for more information.`);
      }
      if (maxDepth === 0) summarize = true;
    }

    const rows: string[][] = [];
    const errors: string[] = [];

    for (const path of paths) {
      const { abs, node } = lookup(state, path);
      if (!node) {
        errors.push(`du: cannot access '${path}': No such file or directory`);
        continue;
      }
      const size = (kb: number) => (human ? humanKB(kb) : String(Math.round(kb)));

      if (summarize || !isDir(node)) {
        rows.push([size(duKB(state, abs)), path]);
        continue;
      }
      // -s가 없으면 하위 디렉터리를 각각 보여주고 마지막에 합계를 낸다 (실제 du와 같은 순서)
      for (const [childPath, child] of walk(node, abs)) {
        if (child.kind !== "dir" || childPath === abs) continue;
        const depth = childPath.slice(abs.length).split("/").filter(Boolean).length;
        if (maxDepth === undefined || depth <= maxDepth) rows.push([size(duKB(state, childPath)), childPath]);
      }
      rows.push([size(duKB(state, abs)), path]);
    }

    const stdout = rows.length ? table(rows, ["right", "left"]) : "";
    if (errors.length) return { stdout, stderr: errors.join("\n"), exitCode: 1 };
    return ok(stdout);
  },
};

/** systemctl status 출력. 실제 출력 형식을 최대한 따라간다. */
function statusText(service: Service, clock: number, journalTail: string[]): string {
  const dot = service.state === "active" ? "●" : service.state === "failed" ? "×" : "○";
  const activeLine =
    service.state === "active"
      ? `active (running) since ${formatFullTime(service.since)}; ${formatAgo(service.since, clock)}`
      : service.state === "failed"
        ? `failed (Result: exit-code) since ${formatFullTime(service.since)}; ${formatAgo(service.since, clock)}`
        : `inactive (dead) since ${formatFullTime(service.since)}; ${formatAgo(service.since, clock)}`;

  const lines = [
    `${dot} ${service.name}.service - ${service.description}`,
    `     Loaded: loaded (${service.unitPath}; ${service.enabled ? "enabled" : "disabled"}; vendor preset: enabled)`,
    `     Active: ${activeLine}`,
  ];

  if (service.state === "active" && service.mainPid) {
    lines.push(`   Main PID: ${service.mainPid} (${service.execStart.split(" ")[0].split("/").pop()})`);
    lines.push("      Tasks: 3 (limit: 2274)");
    lines.push(`     Memory: ${humanKB(service.memKB)}`);
  } else {
    lines.push(`    Process: ExecStart=${service.execStart} (code=exited, status=1/FAILURE)`);
  }
  lines.push(`     CGroup: /system.slice/${service.name}.service`);

  if (journalTail.length) lines.push("", ...journalTail);
  return lines.join("\n");
}

export const systemctl: Command = {
  name: "systemctl",
  summary: "서비스를 조회하고 제어한다 (status/start/stop/restart)",
  usage: "systemctl <status|start|stop|restart|is-active|list-units> [서비스]",
  run({ state, tokens, user }: CommandContext) {
    const args = positionals(tokens);
    const sub = args[0] ?? "list-units";
    const name = args[1];

    if (sub === "list-units" || sub === "list-unit-files") {
      const rows = [["UNIT", "LOAD", "ACTIVE", "SUB", "DESCRIPTION"]];
      for (const s of state.services) {
        rows.push([
          `${s.name}.service`,
          "loaded",
          s.state,
          s.state === "active" ? "running" : s.state === "failed" ? "failed" : "dead",
          s.description,
        ]);
      }
      return ok(table(rows, ["left", "left", "left", "left", "left"]));
    }

    if (!name) return fail(`systemctl: 서비스 이름이 필요합니다\n사용법: ${systemctl.usage}`);
    const service = findService(state, name);
    if (!service) {
      return fail(`Unit ${name.replace(/\.service$/, "")}.service could not be found.`, 4);
    }

    if (sub === "status") {
      // status 아래에 최근 로그 몇 줄을 붙여준다. 실제 systemctl도 이렇게 보여주고,
      // 여기가 플레이어에게 결정적인 단서가 되는 자리다.
      const tailLines = state.journal
        .filter((e) => e.unit === service.name)
        .slice(-6)
        .map((e) => formatJournalLine(e, state.hostname, formatLogTime(e.time)));
      const text = statusText(service, state.clock, tailLines);
      // 실제 systemctl status는 서비스가 정상이 아니면 exit code가 3이다
      return { stdout: text, stderr: "", exitCode: service.state === "active" ? 0 : 3 };
    }

    if (sub === "is-active") {
      return { stdout: service.state, stderr: "", exitCode: service.state === "active" ? 0 : 3 };
    }

    if (sub === "start" || sub === "restart" || sub === "stop") {
      // 서비스 제어는 root 권한이 필요하다. sudo를 빼먹는 건 아주 흔한 실수라 그대로 재현한다.
      if (user !== "root") {
        return fail(
          `Failed to ${sub} ${service.name}.service: Access denied\nSee system logs and 'systemctl status ${service.name}.service' for details.`,
          4,
        );
      }
      if (sub === "stop") {
        stopService(state, service.name);
        return ok();
      }
      if (sub === "restart") stopService(state, service.name);
      const outcome = startService(state, service.name);
      if (outcome.ok) return ok();
      return fail(
        `Job for ${service.name}.service failed because the control process exited with error code.\n` +
          `See "systemctl status ${service.name}.service" and "journalctl -xeu ${service.name}.service" for details.`,
        1,
      );
    }

    return fail(`Unknown operation ${sub}.`);
  },
};

export const journalctl: Command = {
  name: "journalctl",
  summary: "시스템 로그를 본다 (-u 서비스, -n 줄수)",
  usage: "journalctl [-u 서비스] [-n 줄수] [-xe]",
  run({ state, tokens }: CommandContext) {
    const unit = flagValue(tokens, "u", "unit");
    const lines = Number(flagValue(tokens, "n", "lines") ?? 25);

    let entries = state.journal;
    if (unit) {
      const bare = unit.replace(/\.service$/, "");
      // 그 유닛이 직접 남긴 로그 + systemd가 그 유닛에 대해 남긴 로그를 함께 보여준다
      entries = entries.filter((e) => e.unit === bare);
    }

    const shown = entries.slice(-lines);
    if (shown.length === 0) return ok("-- No entries --");

    const header = `-- Logs begin at ${formatFullTime(state.journal[0]?.time ?? state.clock)}, end at ${formatFullTime(state.clock)}. --`;
    const body = shown.map((e) => formatJournalLine(e, state.hostname, formatLogTime(e.time)));
    return ok([header, ...body].join("\n"));
  },
};

/** help는 명령어 목록을 알아야 해서, 레지스트리를 주입받아 만든다. */
export function makeHelp(lookupCommand: (name: string) => Command | undefined): Command {
  return {
    name: "help",
    summary: "이 서버에서 쓸 수 있는 명령어 목록을 본다",
    usage: "help",
    run({ available }: CommandContext) {
      // 표(두 열)로 만들면 설명이 길 때 줄바꿈되면서 정렬이 깨진다.
      // 사용법과 설명을 위아래 두 줄로 두면 터미널 폭이 좁아도 읽을 수 있다.
      const entries = available
        .map((n) => lookupCommand(n))
        .filter((c): c is Command => Boolean(c))
        .map((c) => `  ${c.usage}\n      ${c.summary}`);

      return ok(
        [
          "이 시나리오에서 사용할 수 있는 명령어:",
          "",
          entries.join("\n\n"),
          "",
          "힌트: sudo를 앞에 붙이면 root 권한으로 실행됩니다.",
        ].join("\n"),
      );
    },
  };
}
