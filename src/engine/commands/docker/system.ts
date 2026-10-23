/**
 * 디스크 정리 명령: docker system df · system prune · image prune · builder prune · container prune · rmi.
 * -f 없이 실행하면 실제처럼 확인을 묻는다. 가상 터미널은 대화형 입력이 없어 답하지 않은 것(N)으로 보고 아무것도 지우지 않는다.
 */
import { humanDuration, humanSize } from "../../state/docker/format";
import { deleteImage, diskSummary, pruneBuildCache, pruneContainers, pruneImages, type Reclaim } from "../../state/docker/prune";
import { containerView, findImage } from "../../state/docker/runtime";
import { kbToBytes } from "../../state/docker/storage";
import type { SystemState } from "../../state/types";
import { fail, ok, type CommandResult } from "../types";
import { argsError, dockerFlags, dockerTable } from "./common";

const size = (kb: number) => humanSize(kbToBytes(kb));
const total = (kb: number) => `Total reclaimed space: ${size(kb)}`;
const ask = (warning: string) => ok(`${warning}\nAre you sure you want to continue? [y/N] `);

export function systemDf(state: SystemState, tokens: string[]): CommandResult {
  const parsed = dockerFlags(tokens, {}, "system df");
  if (!parsed.ok) return parsed.result;
  const { images, containers, cache } = diskSummary(state);
  const reclaim = (r: Reclaim, percent = true) =>
    `${size(r.reclaimKB)}${percent && r.sizeKB ? ` (${Math.round((r.reclaimKB / r.sizeKB) * 100)}%)` : ""}`;
  const row = (type: string, r: Reclaim, percent = true) => [type, String(r.total), String(r.active), size(r.sizeKB), reclaim(r, percent)];
  return ok(dockerTable([
    ["TYPE", "TOTAL", "ACTIVE", "SIZE", "RECLAIMABLE"],
    row("Images", images), row("Containers", containers), ["Local Volumes", "0", "0", "0B", "0B"], row("Build Cache", cache, false),
  ]));
}

/** --filter until=24h 같은 값. h·m·s 단위만 받는다. */
function untilOf(filters: string[] | undefined, clock: number): number | undefined | string {
  let until: number | undefined;
  for (const filter of filters ?? []) {
    const match = /^until=(\d+)(h|m|s)$/.exec(filter);
    if (!match) return `Error response from daemon: invalid filter '${filter}'`;
    until = clock - Number(match[1]) * { h: 3_600_000, m: 60_000, s: 1000 }[match[2] as "h" | "m" | "s"];
  }
  return until;
}

export function imagePrune(state: SystemState, tokens: string[]): CommandResult {
  const parsed = dockerFlags(tokens, { switches: { a: "all", all: "all", f: "force", force: "force" }, lists: { filter: "filter" } }, "image prune");
  if (!parsed.ok) return parsed.result;
  const until = untilOf(parsed.lists.filter, state.clock);
  if (typeof until === "string") return fail(until);
  const all = parsed.switches.has("all");
  if (!parsed.switches.has("force")) {
    return ask(all ? "WARNING! This will remove all images without at least one container associated to them." : "WARNING! This will remove all dangling images.");
  }
  const removed = pruneImages(state, all, until);
  return ok([...(removed.lines.length ? ["Deleted Images:", ...removed.lines, ""] : []), total(removed.kb)].join("\n"));
}

function cacheLines(records: { id: string; kb: number; lastUsed: number }[], clock: number): string[] {
  if (!records.length) return [];
  return [dockerTable([["ID", "RECLAIMABLE", "SIZE", "LAST ACCESSED"],
    ...records.map(r => [r.id, "true", size(r.kb), `${humanDuration(clock - r.lastUsed)} ago`])])];
}

export function builderPrune(state: SystemState, tokens: string[], command: string): CommandResult {
  const parsed = dockerFlags(tokens, { switches: { a: "all", all: "all", f: "force", force: "force" } }, command);
  if (!parsed.ok) return parsed.result;
  const all = parsed.switches.has("all");
  if (!parsed.switches.has("force")) return ask(all ? "WARNING! This will remove all build cache." : "WARNING! This will remove all dangling build cache.");
  const removed = pruneBuildCache(state, all);
  return ok([...cacheLines(removed.records, state.clock), `Total:\t${size(removed.kb)}`].join("\n"));
}

export function containerPrune(state: SystemState, tokens: string[]): CommandResult {
  const parsed = dockerFlags(tokens, { switches: { f: "force", force: "force" } }, "container prune");
  if (!parsed.ok) return parsed.result;
  if (!parsed.switches.has("force")) return ask("WARNING! This will remove all stopped containers.");
  const removed = pruneContainers(state);
  return ok([...(removed.ids.length ? ["Deleted Containers:", ...removed.ids, ""] : []), total(removed.kb)].join("\n"));
}

export function systemPrune(state: SystemState, tokens: string[]): CommandResult {
  const parsed = dockerFlags(tokens, { switches: { a: "all", all: "all", f: "force", force: "force" } }, "system prune");
  if (!parsed.ok) return parsed.result;
  const all = parsed.switches.has("all");
  if (!parsed.switches.has("force")) {
    return ask(["WARNING! This will remove:", "  - all stopped containers", "  - all networks not used by at least one container",
      all ? "  - all images without at least one container associated to them" : "  - all dangling images",
      all ? "  - all build cache" : "  - unused build cache", ""].join("\n"));
  }
  // 컨테이너를 먼저 지워야 그 컨테이너가 붙잡던 이미지도 정리 대상이 된다(실제 순서와 같다).
  const containers = pruneContainers(state);
  const images = pruneImages(state, all);
  const cache = pruneBuildCache(state, all);
  return ok([
    ...(containers.ids.length ? ["Deleted Containers:", ...containers.ids, ""] : []),
    ...(images.lines.length ? ["Deleted Images:", ...images.lines, ""] : []),
    ...(cache.records.length ? ["Deleted build cache objects:", ...cache.records.map(r => r.id), ""] : []),
    total(containers.kb + images.kb + cache.kb),
  ].join("\n"));
}

/** docker rmi: 컨테이너가 쓰는 이미지는 지우지 않는다. 실행 중이면 -f로도 안 되고, 멈춘 컨테이너뿐이면 -f로 이름만 뗀다. */
export function rmi(state: SystemState, tokens: string[]): CommandResult {
  const parsed = dockerFlags(tokens, { switches: { f: "force", force: "force" } }, "rmi");
  if (!parsed.ok) return parsed.result;
  if (!parsed.args.length) return argsError("rmi", "rmi [OPTIONS] IMAGE [IMAGE...]", "at least 1 argument");
  const force = parsed.switches.has("force");
  const out: string[] = [];
  const errors: string[] = [];
  for (const ref of parsed.args) {
    const image = findImage(state.docker!, ref);
    if (!image) {
      errors.push(`Error response from daemon: No such image: ${ref.includes(":") || /^[0-9a-f]{4,}$/.test(ref) ? ref : `${ref}:latest`}`);
      continue;
    }
    const users = state.docker!.containers.filter(c => c.imageId === image.id);
    const live = users.find(c => ["running", "restarting"].includes(containerView(c, state.clock).status));
    if (live && force) {
      errors.push(`Error response from daemon: conflict: unable to delete ${image.id.slice(0, 12)} (cannot be forced) - image is being used by running container ${live.id.slice(0, 12)}`);
    } else if (users.length && !force) {
      errors.push(`Error response from daemon: conflict: unable to remove repository reference "${ref}" (must force) - container ${users[0].id.slice(0, 12)} is using its referenced image ${image.id.slice(0, 12)}`);
    } else if (users.length) {
      out.push(`Untagged: ${image.repository}:${image.tag}`);
      image.repository = "<none>";
      image.tag = "<none>";
    } else {
      out.push(...deleteImage(state, image, true).lines);
    }
  }
  return { stdout: out.join("\n"), stderr: errors.join("\n"), exitCode: errors.length ? 1 : 0 };
}
