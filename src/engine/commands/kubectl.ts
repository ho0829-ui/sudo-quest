import { fail, ok, type Command } from "./types";
import { getResources, describeResources } from "./kubectl/queries";
import { rolloutStatus, setImage } from "./kubectl/mutations";
import { RESOURCE_ALIASES, resourceOf } from "./kubectl/resources";

const usage = [
  "kubectl get pods|deploy|svc|endpoints|events|nodes [NAME] [-o wide]",
  "kubectl describe pod|deploy [NAME]",
  "kubectl set image deployment/NAME CONTAINER=IMAGE [CONTAINER=IMAGE ...]",
  "kubectl rollout status deployment/NAME",
].join("\n");

export const kubectl: Command = {
  name: "kubectl", summary: "Kubernetes 리소스 조회 및 Deployment 이미지 변경", usage,
  operations: [
    ...Object.keys(RESOURCE_ALIASES).map(alias => `get ${alias}`),
    ...Object.entries(RESOURCE_ALIASES).filter(([, resource]) => resource === "pods" || resource === "deployments").map(([alias]) => `describe ${alias}`),
    "set image", "rollout status",
  ],
  run({ state, tokens }) {
    if (!tokens.length || (tokens.length === 1 && ["help", "--help", "-h"].includes(tokens[0]))) return ok(usage);
    const [verb, ...input] = tokens;
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
    const cluster = state.kubernetes;
    if (!cluster) return fail("The connection to the server localhost:8080 was refused - did you specify the right host or port?");
    if (verb === "set" && args[0] === "image") return setImage(cluster, args.slice(1), state.clock);
    if (verb === "rollout" && args[0] === "status") return rolloutStatus(cluster, args.slice(1));
    if (verb !== "get" && verb !== "describe") return fail(`error: unknown command "${tokens.join(" ")}" for "kubectl"`);
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
