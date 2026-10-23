/** 시스템 상태를 보는 명령어들: df, du, journalctl, help (systemctl은 systemctl.ts) */
import { flagValue, hasFlag, positionals } from "../parser/parse";
import { allDiskUsage, duKB, mountFor } from "../state/derived";
import { isDir, lookup, walk } from "../state/fs";
import { formatFullTime, formatLogTime, humanKB, table } from "../state/format";
import { formatJournalLine } from "../state/log";
import { fail, ok, type Command, type CommandContext } from "./types";

export const df: Command = {
  name: "df",
  summary: "디스크 사용량을 본다 (-h 읽기 쉬운 단위)",
  usage: "df [-h] [경로...]",
  run({ state, tokens }: CommandContext) {
    const human = hasFlag(tokens, "h", "human-readable");
    const fmt = (kb: number) => (human ? humanKB(kb) : String(Math.round(kb)));

    const rows = [["Filesystem", "Size", "Used", "Avail", "Use%", "Mounted on"]];
    // 경로를 주면 그 경로가 속한 파일시스템만 보여 준다(df -h /var/lib/docker).
    const paths = positionals(tokens);
    for (const path of paths) {
      if (!lookup(state, path).node) return fail(`df: ${path}: No such file or directory`);
    }
    const mounts = new Set(paths.map((path) => mountFor(state, lookup(state, path).abs).mount));
    for (const usage of allDiskUsage(state).filter((u) => !mounts.size || mounts.has(u.disk.mount))) {
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

export const journalctl: Command = {
  name: "journalctl",
  summary: "시스템 로그를 본다 (-u 서비스, -n 줄수)",
  usage: "journalctl [-u 서비스] [-n 줄수] [-xe]",
  run({ state, tokens }: CommandContext) {
    const unit = flagValue(tokens, "u", "unit");
    const requested = flagValue(tokens, "n", "lines");
    if ((hasFlag(tokens, "n", "lines") && requested === undefined) || (requested !== undefined && !/^\d+$/.test(requested))) {
      return fail(`Failed to parse lines '${requested ?? ""}'`);
    }
    const lines = Number(requested ?? 25);
    if (!Number.isSafeInteger(lines)) return fail(`Failed to parse lines '${requested}'`);
    if (lines === 0) return ok();

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
