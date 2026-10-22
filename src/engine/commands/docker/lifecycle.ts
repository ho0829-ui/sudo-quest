/** 상태를 바꾸는 명령: docker start · stop · restart · rm. 이름을 여러 개 받으면 하나씩 처리하고 이름을 그대로 찍는다. */
import { removeContainer, startContainer, stopContainer } from "../../state/docker/lifecycle";
import { findContainer } from "../../state/docker/runtime";
import type { SystemState } from "../../state/types";
import { type CommandResult } from "../types";
import { argsError, dockerFlags, noSuchContainer } from "./common";

type Action = "start" | "stop" | "restart" | "rm";

const USAGE: Record<Action, string> = {
  start: "start [OPTIONS] CONTAINER [CONTAINER...]",
  stop: "stop [OPTIONS] CONTAINER [CONTAINER...]",
  restart: "restart [OPTIONS] CONTAINER [CONTAINER...]",
  rm: "rm [OPTIONS] CONTAINER [CONTAINER...]",
};

export function lifecycle(state: SystemState, action: Action, tokens: string[]): CommandResult {
  const spec = action === "rm" ? { switches: { f: "force", force: "force" } }
    : action === "start" ? {} : { values: { t: "time", time: "time" } };
  const parsed = dockerFlags(tokens, spec, action);
  if (!parsed.ok) return parsed.result;
  if (!parsed.args.length) return argsError(action, USAGE[action], "at least 1 argument");
  const docker = state.docker!;
  const out: string[] = [];
  const errors: string[] = [];
  const failed: string[] = [];
  for (const name of parsed.args) {
    const container = findContainer(docker, name);
    if (!container) {
      errors.push(noSuchContainer(name));
      failed.push(name);
      continue;
    }
    if (action === "stop") stopContainer(state, container);
    if (action === "rm") {
      const removed = removeContainer(state, container, parsed.switches.has("force"));
      if (!removed.ok) {
        errors.push(`Error response from daemon: ${removed.error}`);
        continue;
      }
    }
    if (action === "start" || action === "restart") {
      if (action === "restart") stopContainer(state, container);
      const started = startContainer(state, container);
      if (!started.ok) {
        errors.push(action === "restart"
          ? `Error response from daemon: Cannot restart container ${name}: ${started.error}`
          : `Error response from daemon: ${started.error}`);
        failed.push(name);
        continue;
      }
    }
    out.push(name);
  }
  // docker start는 실패한 컨테이너 이름을 마지막 줄에 다시 모아 알려 준다.
  if (action === "start" && failed.length) errors.push(`Error: failed to start containers: ${failed.join(", ")}`);
  return { stdout: out.join("\n"), stderr: errors.join("\n"), exitCode: errors.length ? 1 : 0 };
}
