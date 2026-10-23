/**
 * docker: 가상 Docker 엔진(state/docker)을 조회하고 바꾼다. 실제 Docker 소켓·명령은 쓰지 않는다.
 * docker container ls처럼 관리 명령 묶음으로 쓰는 형태도 같은 하위 명령으로 보낸다.
 */
import { findService } from "../state/services";
import { fail, ok, type Command } from "./types";
import { inspect } from "./docker/inspect";
import { lifecycle } from "./docker/lifecycle";
import { images, logs, port, ps } from "./docker/query";
import { run } from "./docker/run";
import { builderPrune, containerPrune, imagePrune, rmi, systemDf, systemPrune } from "./docker/system";

const usage = [
  "Usage:  docker [OPTIONS] COMMAND",
  "",
  "Commands:",
  "  ps          List containers (-a 모두, -q ID만, --format)",
  "  images      List images",
  "  logs        Fetch the logs of a container (--tail N)",
  "  inspect     Return low-level information on a container (-f '{{.State.Status}}')",
  "  port        List port mappings for the container",
  "  run         Create and run a new container (-d --name -p -e --env-file --restart)",
  "  start | stop | restart | rm [-f]",
  "  rmi         Remove one or more images",
  "  system df | system prune [-a] [-f]",
  "  image prune [-a] [-f] [--filter until=24h] | builder prune [-a] [-f] | container prune [-f]",
].join("\n");

const SUBCOMMANDS = ["ps", "images", "logs", "inspect", "port", "run", "start", "stop", "restart", "rm", "rmi"] as const;
/** 두 단어로 쓰는 정리 명령. buildx prune은 builder prune과 같은 일을 한다. */
const MANAGEMENT = ["system df", "system prune", "image prune", "image rm", "builder prune", "buildx prune", "container prune"] as const;
const CONTAINER_ALIASES: Record<string, string> = { ls: "ps", list: "ps", ps: "ps", logs: "logs", inspect: "inspect", port: "port", run: "run", start: "start", stop: "stop", restart: "restart", rm: "rm" };

export const docker: Command = {
  name: "docker", summary: "컨테이너·이미지 조회와 실행·정지·삭제", usage,
  operations: [
    ...SUBCOMMANDS,
    ...Object.keys(CONTAINER_ALIASES).map(alias => `container ${alias}`),
    "image ls", "image list", ...MANAGEMENT,
  ],
  run(ctx) {
    const { state, tokens } = ctx;
    if (!tokens.length || ["--help", "-h", "help"].includes(tokens[0])) return ok(usage);
    let [verb, ...input] = tokens;
    if (verb === "container" && input[0] && CONTAINER_ALIASES[input[0]]) [verb, input] = [CONTAINER_ALIASES[input[0]], input.slice(1)];
    else if (verb === "image" && (input[0] === "ls" || input[0] === "list")) [verb, input] = ["images", input.slice(1)];
    const pair = `${verb} ${input[0] ?? ""}`;
    const management = (MANAGEMENT as readonly string[]).includes(pair);
    if (!management && !(SUBCOMMANDS as readonly string[]).includes(verb)) return fail(`docker: '${tokens[0]}' is not a docker command.\nSee 'docker --help'`);
    // 데몬(dockerd)이 내려가 있으면 CLI는 소켓에 연결하지 못한다.
    if (!state.docker || findService(state, "docker")?.state !== "active") {
      return fail("Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?");
    }
    const engine = state.docker;
    if (management) {
      const rest = input.slice(1);
      if (pair === "system df") return systemDf(state, rest);
      if (pair === "system prune") return systemPrune(state, rest);
      if (pair === "image prune") return imagePrune(state, rest);
      if (pair === "image rm") return rmi(state, rest);
      if (pair === "container prune") return containerPrune(state, rest);
      return builderPrune(state, rest, pair);
    }
    switch (verb) {
      case "rmi": return rmi(state, input);
      case "ps": return ps(engine, input, state.clock);
      case "images": return images(state, input);
      case "logs": return logs(engine, input, state.clock);
      case "inspect": return inspect(engine, input, state.clock);
      case "port": return port(engine, input, state.clock);
      case "run": return run(ctx, input);
      default: return lifecycle(state, verb as "start" | "stop" | "restart" | "rm", input);
    }
  },
};
