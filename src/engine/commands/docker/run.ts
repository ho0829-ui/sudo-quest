/**
 * docker run: 컨테이너를 만들고 바로 시작한다. 옵션은 IMAGE 앞에서만 읽고, 뒤는 컨테이너 명령이다.
 * -e KEY처럼 값 없이 이름만 주면 실제 docker는 이 셸의 값을 넘긴다. 가상 셸에는 export된 값이 없으므로 넣지 않는다.
 */
import { hexId } from "../../state/docker/format";
import { createContainer, startContainer } from "../../state/docker/lifecycle";
import { containerLogs, containerView } from "../../state/docker/runtime";
import type { PortBinding, RestartPolicy } from "../../state/docker/types";
import { canRead, lookup } from "../../state/fs";
import type { CommandContext, CommandResult } from "../types";
import { fail } from "../types";
import { argsError, dockerFlags } from "./common";

const runFail = (message: string): CommandResult => fail(`docker: ${message}\nSee 'docker run --help'.`, 125);

function parsePort(spec: string): PortBinding | string {
  const match = /^(?:(\d{1,3}(?:\.\d{1,3}){3}):)?(?:(\d+):)?(\d+)(?:\/(tcp|udp))?$/.exec(spec);
  if (!match) return `Invalid containerPort: ${spec}.`;
  const [, hostIp = "", host, container, proto = "tcp"] = match;
  if (Number(container) < 1 || Number(container) > 65535) return `Invalid containerPort: ${container}.`;
  if (host !== undefined && (Number(host) < 1 || Number(host) > 65535)) return `Invalid hostPort: ${host}.`;
  // 호스트 포트를 생략하면 Docker가 빈 포트를 고른다. 가상 엔진은 0으로 두고 아래에서 채운다.
  return { hostIp, hostPort: host === undefined ? 0 : Number(host), containerPort: Number(container), proto: proto as "tcp" | "udp" };
}

function parseRestart(value: string): RestartPolicy | string {
  const [name, count] = value.split(":");
  if (!["no", "always", "unless-stopped", "on-failure"].includes(name)) {
    return `invalid restart policy: unknown policy '${name}'; use one of 'no', 'always', 'on-failure', or 'unless-stopped'.`;
  }
  if (count !== undefined && name !== "on-failure") return "invalid restart policy: maximum retry count can only be used with 'on-failure'.";
  if (count !== undefined && !/^\d+$/.test(count)) return `invalid restart policy format: maximum retry count must be an integer.`;
  return { name: name as RestartPolicy["name"], maximumRetryCount: Number(count ?? 0) };
}

/** KEY=VALUE 한 줄. 값 없이 KEY만 있으면 셸 값을 넘기는데, 가상 셸에는 없으므로 건너뛴다(null). */
function envEntry(line: string): [string, string] | null | string {
  const index = line.indexOf("=");
  if (index === 0) return `invalid environment variable: ${line}.`;
  return index < 0 ? null : [line.slice(0, index), line.slice(index + 1)];
}

/** --env-file은 docker CLI가 실행한 계정 권한으로 읽는다. 따옴표는 벗기지 않고 값의 일부로 둔다(실제와 같다). */
function readEnvFile(ctx: CommandContext, path: string, env: Record<string, string>): string | null {
  const { node } = lookup(ctx.state, path);
  if (!node || node.kind !== "file") return `open ${path}: no such file or directory.`;
  if (!canRead(node, ctx.user)) return `open ${path}: permission denied.`;
  for (const raw of node.content.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const entry = envEntry(line);
    if (typeof entry === "string") return entry;
    if (entry) env[entry[0]] = entry[1];
  }
  return null;
}

function freeHostPort(ctx: CommandContext): number {
  const used = new Set(ctx.state.processes.flatMap(p => p.listenPorts ?? []).map(l => l.port));
  let port = 32768;
  while (used.has(port)) port++;
  return port;
}

export function run(ctx: CommandContext, tokens: string[]): CommandResult {
  const parsed = dockerFlags(tokens, {
    values: { name: "name", restart: "restart" },
    lists: { p: "publish", publish: "publish", e: "env", env: "env", "env-file": "envFile" },
    switches: { d: "detach", detach: "detach" },
    stopAtFirstArg: true,
  }, "run");
  if (!parsed.ok) return parsed.result;
  const [image, ...cmd] = parsed.args;
  if (!image) return argsError("run", "run [OPTIONS] IMAGE [COMMAND] [ARG...]", "at least 1 argument");

  const ports: PortBinding[] = [];
  for (const spec of parsed.lists.publish ?? []) {
    const port = parsePort(spec);
    if (typeof port === "string") return runFail(port);
    ports.push(port.hostPort === 0 ? { ...port, hostPort: freeHostPort(ctx) } : port);
  }
  // -e가 --env-file보다 우선한다(같은 이름이면 -e 값을 쓴다).
  const env: Record<string, string> = {};
  for (const path of parsed.lists.envFile ?? []) {
    const error = readEnvFile(ctx, path, env);
    if (error) return runFail(error);
  }
  for (const line of parsed.lists.env ?? []) {
    const entry = envEntry(line);
    if (typeof entry === "string") return runFail(entry);
    if (entry) env[entry[0]] = entry[1];
  }
  const restart = parseRestart(parsed.values.restart ?? "no");
  if (typeof restart === "string") return runFail(restart);

  const { state } = ctx;
  const docker = state.docker!;
  const name = parsed.values.name ?? `container_${hexId(`${image}@${state.clock}@${docker.containers.length}`).slice(0, 6)}`;
  const created = createContainer(docker, { name, image, env, ports, restart, createdAt: state.clock });
  if (!created.ok) {
    if (created.error.startsWith("Unable to find image")) {
      const repository = image.split(":")[0];
      return fail(`${created.error}\ndocker: Error response from daemon: pull access denied for ${repository}, repository does not exist or may require 'docker login': denied: requested access to the resource is denied.\nSee 'docker run --help'.`, 125);
    }
    return runFail(`Error response from daemon: ${created.error}`);
  }
  const container = created.container;
  if (cmd.length) container.cmd = cmd;
  const started = startContainer(state, container);
  if (!started.ok) return runFail(`Error response from daemon: ${started.error}`);
  if (parsed.switches.has("detach")) return { stdout: container.id, stderr: "", exitCode: 0 };
  // -d 없이 실행하면 실제로는 터미널이 컨테이너에 붙는다. 가상 터미널은 멈출 수 없어 지금까지의 출력만 보여 준다.
  const view = containerView(container, state.clock);
  return { stdout: containerLogs(docker, container, state.clock).join("\n"), stderr: "", exitCode: view.status === "running" ? 0 : view.exitCode };
}
