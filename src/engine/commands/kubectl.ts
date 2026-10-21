import { fail, ok, type Command } from "./types";
import { getResources, describeResources } from "./kubectl/queries";
import { logs } from "./kubectl/logs";
import { rolloutHistory, rolloutStatus, rolloutUndo } from "./kubectl/rollout";
import { setEnv, setImage, setResources } from "./kubectl/set";
import { RESOURCE_ALIASES, resourceOf } from "./kubectl/resources";

const usage = [
  "kubectl get pods|deploy|svc|endpoints|events|nodes [NAME] [-o wide]",
  "kubectl describe pod|deploy [NAME]",
  "kubectl logs POD|deploy/NAME [-c CONTAINER] [-p|--previous] [--tail=N]",
  "kubectl set image deployment/NAME CONTAINER=IMAGE [CONTAINER=IMAGE ...]",
  "kubectl set env deployment/NAME [-c CONTAINER] KEY=VALUE ... | KEY- | --list",
  "kubectl set resources deployment/NAME [-c CONTAINER] --limits=memory=512Mi [--requests=memory=256Mi]",
  "kubectl rollout status|history deployment/NAME",
  "kubectl rollout undo deployment/NAME [--to-revision=N]",
].join("\n");

export const kubectl: Command = {
  name: "kubectl", summary: "Kubernetes 리소스 조회·로그·배포 변경과 되돌리기", usage,
  operations: [
    ...Object.keys(RESOURCE_ALIASES).map(alias => `get ${alias}`),
    ...Object.entries(RESOURCE_ALIASES).filter(([, resource]) => resource === "pods" || resource === "deployments").map(([alias]) => `describe ${alias}`),
    "logs", "set image", "set env", "set resources", "rollout status", "rollout history", "rollout undo",
  ],
  run({ state, tokens }) {
    if (!tokens.length || (tokens.length === 1 && ["help", "--help", "-h"].includes(tokens[0]))) return ok(usage);
    const [verb, ...input] = tokens;
    const cluster = state.kubernetes;
    if (!cluster) return fail("The connection to the server localhost:8080 was refused - did you specify the right host or port?");
    // 옵션 모양이 하위 명령마다 달라 각자 읽는다(logs·set env·set resources·rollout undo).
    if (verb === "logs") return logs(cluster, input);
    if (verb === "set" && input[0] === "image") return setImage(cluster, input.slice(1), state.clock);
    if (verb === "set" && input[0] === "env") return setEnv(cluster, input.slice(1), state.clock);
    if (verb === "set" && input[0] === "resources") return setResources(cluster, input.slice(1), state.clock);
    if (verb === "rollout" && input[0] === "status") return rolloutStatus(cluster, input.slice(1));
    if (verb === "rollout" && input[0] === "history") return rolloutHistory(cluster, input.slice(1));
    if (verb === "rollout" && input[0] === "undo") return rolloutUndo(cluster, input.slice(1), state.clock);
    if (verb !== "get" && verb !== "describe") return fail(`error: unknown command "${tokens.join(" ")}" for "kubectl"`);
    const args: string[] = [];
    let wide = false;
    for (let i = 0; i < input.length; i++) {
      const token = input[i];
      if (verb === "get" && ["-o", "--output"].includes(token)) {
        if (wide || input[++i] !== "wide") return fail("error: supported output format: wide");
        wide = true;
      } else if (verb === "get" && ["-o=wide", "--output=wide"].includes(token) && !wide) wide = true;
      else if (token.startsWith("-")) return fail(`error: unknown flag: ${token}`);
      else args.push(token);
    }
    const parts = args[0]?.split("/") ?? [];
    const resource = resourceOf(parts[0] ?? "");
    if (!resource) return fail(`error: the server doesn't have a resource type "${parts[0] ?? ""}"`);
    if (args.length > 2 || parts.length > 2 || (parts.length === 2 && (!parts[1] || args[1]))) {
      return fail("error: specify one resource type and an optional name");
    }
    const name = parts[1] ?? args[1];
    return verb === "get" ? getResources(cluster, resource, name, wide, state.clock)
      : describeResources(cluster, resource, name, state.clock);
  },
};
