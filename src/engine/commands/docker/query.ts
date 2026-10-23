/** 조회 명령: docker ps · images · logs · port. 모두 저장 상태와 시각에서 계산한다. */
import { humanDuration, humanSize, portsText, statusText } from "../../state/docker/format";
import { imageKB, kbToBytes } from "../../state/docker/storage";
import type { SystemState } from "../../state/types";
import { containerLogs, containerView, findContainer } from "../../state/docker/runtime";
import type { DockerState } from "../../state/docker/types";
import { fail, ok, type CommandResult } from "../types";
import { argsError, dockerFlags, dockerTable, noSuchContainer } from "./common";
import { renderTemplate } from "./template";

/** docker ps의 COMMAND: 따옴표로 감싸고 20글자가 넘으면 줄임표로 자른다. */
function commandText(cmd: string[]): string {
  const full = cmd.join(" ");
  return `"${full.length > 20 ? `${full.slice(0, 19)}…` : full}"`;
}

export function ps(docker: DockerState, tokens: string[], clock: number): CommandResult {
  const parsed = dockerFlags(tokens, { switches: { a: "all", all: "all", q: "quiet", quiet: "quiet" }, values: { format: "format" } }, "ps");
  if (!parsed.ok) return parsed.result;
  if (parsed.args.length) return argsError("ps", "ps [OPTIONS]", "no arguments");
  const all = parsed.switches.has("all");
  const rows = [...docker.containers].sort((a, b) => b.createdAt - a.createdAt).map(container => {
    const view = containerView(container, clock);
    return {
      ID: container.id.slice(0, 12), Image: container.image, Command: commandText(container.cmd),
      RunningFor: `${humanDuration(clock - container.createdAt)} ago`, Status: statusText(view, clock),
      Ports: portsText(container, view), Names: container.name, State: view.status,
    };
  }).filter(row => all || row.State === "running" || row.State === "restarting");
  if (parsed.switches.has("quiet")) return ok(rows.map(row => row.ID).join("\n"));
  const format = parsed.values.format;
  if (format) {
    const lines: string[] = [];
    for (const row of rows) {
      const rendered = renderTemplate(format.replace(/^table\s+/, ""), row);
      if (!rendered.ok) return fail(rendered.error, 1);
      lines.push(rendered.text);
    }
    return ok(lines.join("\n"));
  }
  const header = ["CONTAINER ID", "IMAGE", "COMMAND", "CREATED", "STATUS", "PORTS", "NAMES"];
  return ok(dockerTable([header, ...rows.map(r => [r.ID, r.Image, r.Command, r.RunningFor, r.Status, r.Ports, r.Names])]));
}

/** docker images [-a] [-q] [-f dangling=true|false] [REPOSITORY[:TAG]]. 크기는 레이어 파일에서 계산한다. */
export function images(state: SystemState, tokens: string[]): CommandResult {
  const docker = state.docker!;
  const parsed = dockerFlags(tokens, { switches: { q: "quiet", quiet: "quiet", a: "all", all: "all" }, lists: { f: "filter", filter: "filter" } }, "images");
  if (!parsed.ok) return parsed.result;
  let dangling: boolean | undefined;
  for (const filter of parsed.lists.filter ?? []) {
    const match = /^dangling=(true|false)$/.exec(filter);
    if (!match) return fail(`Error response from daemon: invalid filter '${filter.split("=")[0]}'`);
    dangling = match[1] === "true";
  }
  const [repository, tag] = (parsed.args[0] ?? "").split(":");
  const list = [...docker.images].sort((a, b) => b.createdAt - a.createdAt).filter(image =>
    (!repository || (image.repository === repository && (!tag || image.tag === tag)))
    && (dangling === undefined || (image.repository === "<none>") === dangling));
  if (parsed.switches.has("quiet")) return ok(list.map(image => image.id.slice(0, 12)).join("\n"));
  const header = ["REPOSITORY", "TAG", "IMAGE ID", "CREATED", "SIZE"];
  return ok(dockerTable([header, ...list.map(image => [
    image.repository, image.tag, image.id.slice(0, 12), `${humanDuration(state.clock - image.createdAt)} ago`, humanSize(kbToBytes(imageKB(state, image)), 3),
  ])]));
}

export function logs(docker: DockerState, tokens: string[], clock: number): CommandResult {
  const parsed = dockerFlags(tokens, { values: { tail: "tail", n: "tail" }, switches: { f: "follow", follow: "follow" } }, "logs");
  if (!parsed.ok) return parsed.result;
  if (parsed.args.length !== 1) return argsError("logs", "logs [OPTIONS] CONTAINER", "exactly 1 argument");
  const container = findContainer(docker, parsed.args[0]);
  if (!container) return fail(noSuchContainer(parsed.args[0]));
  const tail = parsed.values.tail ?? "all";
  if (tail !== "all" && !/^-?\d+$/.test(tail)) return fail(`invalid value for "tail": ${tail}`, 1);
  let lines = containerLogs(docker, container, clock);
  if (tail !== "all" && Number(tail) >= 0) lines = Number(tail) === 0 ? [] : lines.slice(-Number(tail));
  // -f(따라가기)는 가상 터미널이 멈출 수 없어 지금까지의 로그만 보여 주고 끝낸다.
  return ok(lines.join("\n"));
}

export function port(docker: DockerState, tokens: string[], clock: number): CommandResult {
  const parsed = dockerFlags(tokens, {}, "port");
  if (!parsed.ok) return parsed.result;
  if (parsed.args.length < 1 || parsed.args.length > 2) return argsError("port", "port CONTAINER [PRIVATE_PORT[/PROTO]]", "at least 1 argument");
  const container = findContainer(docker, parsed.args[0]);
  if (!container) return fail(noSuchContainer(parsed.args[0]));
  if (containerView(container, clock).status !== "running") return ok("");
  const [wanted, proto = "tcp"] = (parsed.args[1] ?? "").split("/");
  const bindings = container.ports.filter(b => !wanted || (String(b.containerPort) === wanted && b.proto === proto));
  if (wanted && !bindings.length) return fail(`Error: No public port '${wanted}/${proto}' published for ${container.name}`);
  return ok(bindings.map(b => `${wanted ? "" : `${b.containerPort}/${b.proto} -> `}${b.hostIp || "0.0.0.0"}:${b.hostPort}`).join("\n"));
}
