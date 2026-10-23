/** docker inspect: 컨테이너 상태를 실제 docker와 같은 JSON 모양(자주 보는 필드만)으로 계산해 보여 준다. */
import { isoTime } from "../../state/docker/format";
import { containerView, findContainer, mergedEnv } from "../../state/docker/runtime";
import type { DockerContainer, DockerState } from "../../state/docker/types";
import { fail, type CommandResult } from "../types";
import { argsError, dockerFlags } from "./common";
import { renderTemplate } from "./template";

const NEVER = "0001-01-01T00:00:00Z";

function portKey(port: number, proto: string) {
  return `${port}/${proto}`;
}

export function inspectObject(docker: DockerState, container: DockerContainer, clock: number) {
  const view = containerView(container, clock);
  const image = docker.images.find(i => i.id === container.imageId);
  const running = view.status === "running";
  const bindings: Record<string, { HostIp: string; HostPort: string }[]> = {};
  for (const b of container.ports) (bindings[portKey(b.containerPort, b.proto)] ??= []).push({ HostIp: b.hostIp, HostPort: String(b.hostPort) });
  return {
    Id: container.id,
    Created: isoTime(container.createdAt),
    Path: container.cmd[0],
    Args: container.cmd.slice(1),
    State: {
      Status: view.status, Running: running, Paused: false, Restarting: view.status === "restarting",
      // OOMKilled는 커널이 메모리 한도로 죽였을 때만 true다. 설정 오류 종료(1)는 false.
      OOMKilled: !running && container.last?.reason === "OOMKilled", Dead: false,
      Pid: running ? 2000 + (parseInt(container.id.slice(0, 4), 16) % 30000) : 0,
      ExitCode: view.exitCode, Error: container.error,
      StartedAt: view.startedAt === undefined ? NEVER : isoTime(view.startedAt),
      FinishedAt: view.finishedAt === undefined || running ? NEVER : isoTime(view.finishedAt),
    },
    Image: `sha256:${container.imageId}`,
    Name: `/${container.name}`,
    RestartCount: view.restartCount,
    HostConfig: {
      PortBindings: bindings,
      RestartPolicy: { Name: container.restart.name, MaximumRetryCount: container.restart.maximumRetryCount },
    },
    Config: {
      Hostname: container.id.slice(0, 12),
      Env: Object.entries(mergedEnv(container, image)).map(([key, value]) => `${key}=${value}`),
      Cmd: container.cmd,
      Image: container.image,
      ExposedPorts: Object.fromEntries((image?.profile.ports ?? []).map(p => [portKey(p, "tcp"), {}])),
    },
    NetworkSettings: {
      Ports: running ? Object.fromEntries(Object.entries(bindings).map(([key, list]) => [key, list.map(b => ({ HostIp: b.HostIp || "0.0.0.0", HostPort: b.HostPort }))])) : {},
      IPAddress: container.ip ?? "",
    },
  };
}

export function inspect(docker: DockerState, tokens: string[], clock: number): CommandResult {
  const parsed = dockerFlags(tokens, { values: { f: "format", format: "format" } }, "inspect");
  if (!parsed.ok) return parsed.result;
  if (!parsed.args.length) return argsError("inspect", "inspect [OPTIONS] NAME|ID [NAME|ID...]", "at least 1 argument");
  const found: ReturnType<typeof inspectObject>[] = [];
  const errors: string[] = [];
  for (const name of parsed.args) {
    const container = findContainer(docker, name);
    if (container) found.push(inspectObject(docker, container, clock));
    else errors.push(`Error: No such object: ${name}`);
  }
  const format = parsed.values.format;
  let stdout = JSON.stringify(found, null, 4);
  if (format) {
    const lines: string[] = [];
    for (const object of found) {
      const rendered = renderTemplate(format, object);
      if (!rendered.ok) return fail(rendered.error);
      lines.push(rendered.text);
    }
    stdout = lines.join("\n");
  }
  if (errors.length && !found.length && !format) stdout = "[]";
  return { stdout, stderr: errors.join("\n"), exitCode: errors.length ? 1 : 0 };
}

