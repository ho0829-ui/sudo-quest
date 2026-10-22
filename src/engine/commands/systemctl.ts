/** systemctl: 서비스 조회·제어. 서비스 상태와 시작 실패 규칙은 state/services.ts가 정한다. */
import { positionals } from "../parser/parse";
import { unknownBooleanOption } from "./booleanOptions";
import { formatAgo, formatFullTime, formatLogTime, humanKB, table } from "../state/format";
import { formatJournalLine } from "../state/log";
import { findService, reloadService, startService, stopService } from "../state/services";
import { daemonReload, dropInDir, needsReload, reloadWarning, unitFiles } from "../state/systemdUnits";
import type { Service, SystemState } from "../state/types";
import { SYSTEMD_NOFILE } from "../state/limits";
import { fail, ok, type Command, type CommandContext } from "./types";

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
  summary: "서비스를 조회하고 제어한다 (status/start/stop/restart/reload/cat/show/daemon-reload)",
  usage: "systemctl <status|start|stop|restart|reload|is-active|cat|show|daemon-reload|list-units> [서비스] [-p 속성]",
  run({ state, tokens: raw, user }: CommandContext) {
    // show -p A,B / --property=A,B 의 값을 먼저 떼어 낸다(나머지는 켜고 끄는 옵션만 있다).
    const properties: string[] = [];
    const tokens: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const inline = /^--property=(.*)$/.exec(raw[i]);
      if (raw[i] === "-p" || raw[i] === "--property") properties.push(...(raw[++i] ?? "").split(","));
      else if (inline) properties.push(...inline[1].split(","));
      else tokens.push(raw[i]);
    }
    const unknown = unknownBooleanOption(tokens, "l", ["no-pager", "full"]);
    if (unknown) return fail(`systemctl: unrecognized option '${unknown}'`);
    const args = positionals(tokens);
    if (args.length > 2) return fail("systemctl: expected one unit name");
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

    if (sub === "daemon-reload") {
      if (user !== "root") return fail("Failed to reload daemon: Access denied", 1);
      daemonReload(state);
      return ok();
    }

    if (!name) {
      if (sub !== "status") return fail("Too few arguments.");
      const failed = state.services.filter((s) => s.state === "failed").length;
      return ok([`● ${state.hostname}`, `    State: ${failed ? "degraded" : "running"}`, "    Units: " + state.services.length + " loaded", `     Jobs: 0 queued`, `   Failed: ${failed} units`].join("\n"));
    }
    const service = findService(state, name);
    if (!service) {
      return fail(`Unit ${name.replace(/\.service$/, "")}.service could not be found.`, 4);
    }

    if (sub === "cat") {
      const files = unitFiles(state, service);
      if (!files.length) return fail(`No files found for ${service.name}.service.`);
      return ok(files.map(f => `# ${f.path}\n${f.content.replace(/\n$/, "")}`).join("\n\n"));
    }

    if (sub === "show") return ok(showText(state, service, properties));

    if (sub === "status") {
      // status 아래에 최근 로그 몇 줄을 붙여준다. 실제 systemctl도 이렇게 보여주고,
      // 여기가 플레이어에게 결정적인 단서가 되는 자리다.
      const tailLines = state.journal
        .filter((e) => e.unit === service.name)
        .slice(-6)
        .map((e) => formatJournalLine(e, state.hostname, formatLogTime(e.time)));
      const text = (needsReload(state, service) ? `${reloadWarning(service)}\n` : "") + statusText(service, state.clock, tailLines);
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
      // unit 파일을 고치고 daemon-reload를 안 했으면 systemd는 경고만 하고 옛 설정으로 시작한다.
      const warning = needsReload(state, service) ? reloadWarning(service) : "";
      const outcome = startService(state, service.name);
      if (outcome.ok) return { stdout: "", stderr: warning, exitCode: 0 };
      return fail(
        `Job for ${service.name}.service failed because the control process exited with error code.\n` +
          `See "systemctl status ${service.name}.service" and "journalctl -xeu ${service.name}.service" for details.`,
        1,
      );
    }

    if (sub === "reload") {
      if (user !== "root") {
        return fail(`Failed to reload ${service.name}.service: Access denied\nSee system logs and 'systemctl status ${service.name}.service' for details.`, 4);
      }
      const outcome = reloadService(state, service.name);
      if (outcome.ok) return ok();
      if (outcome.why === "not-applicable") return fail(`Failed to reload ${service.name}.service: Job type reload is not applicable for unit ${service.name}.service.`);
      if (outcome.why === "inactive") return fail(`${service.name}.service is not active, cannot reload.`);
      return fail(`Job for ${service.name}.service failed because the control process exited with error code.\n` +
        `See "systemctl status ${service.name}.service" and "journalctl -xeu ${service.name}.service" for details.`);
    }

    return fail(`Unknown operation ${sub}.`);
  },
};

/** systemctl show: systemd가 지금 쓰는 설정(마지막 daemon-reload 기준)을 보여 준다. 파일 내용과 다를 수 있다. */
function showText(state: SystemState, service: Service, properties: string[]): string {
  const nofile = service.loaded?.nofile ?? SYSTEMD_NOFILE;
  const dropIns = unitFiles(state, service).map((f) => f.path).filter((path) => path.startsWith(dropInDir(service)));
  const values: Record<string, string> = {
    Type: "simple", MainPID: String(service.mainPid ?? 0), ActiveState: service.state,
    SubState: service.state === "active" ? "running" : service.state === "failed" ? "failed" : "dead",
    FragmentPath: service.unitPath, DropInPaths: dropIns.join(" "), ExecStart: `{ path=${service.execStart.split(" ")[0]} ; argv[]=${service.execStart} }`,
    LimitNOFILE: String(nofile.hard), LimitNOFILESoft: String(nofile.soft),
    NeedDaemonReload: needsReload(state, service) ? "yes" : "no",
  };
  const keys = properties.length ? properties.filter(Boolean) : Object.keys(values);
  return keys.filter((key) => key in values).map((key) => `${key}=${values[key]}`).join("\n");
}
