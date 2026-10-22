/** docker CLI가 쓰는 시간·상태·포트 표기. 실제 CLI(go-units HumanDuration)와 같은 문구를 만든다. */
import type { ContainerView } from "./runtime";
import type { DockerContainer, PortBinding } from "./types";

export function humanDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 1) return "Less than a second";
  if (seconds === 1) return "1 second";
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.floor(ms / 60_000);
  if (minutes === 1) return "About a minute";
  if (minutes < 60) return `${minutes} minutes`;
  const hours = Math.floor(ms / 3_600_000 + 0.5);
  if (hours === 1) return "About an hour";
  if (hours < 48) return `${hours} hours`;
  if (hours < 24 * 7 * 2) return `${Math.floor(hours / 24)} days`;
  if (hours < 24 * 30 * 2) return `${Math.floor(hours / 24 / 7)} weeks`;
  if (hours < 24 * 365 * 2) return `${Math.floor(hours / 24 / 30)} months`;
  return `${Math.floor(hours / 24 / 365)} years`;
}

export function statusText(view: ContainerView, clock: number): string {
  if (view.status === "created") return "Created";
  if (view.status === "running") return `Up ${humanDuration(clock - (view.startedAt ?? clock))}`;
  const ago = humanDuration(clock - (view.finishedAt ?? clock));
  return `${view.status === "restarting" ? "Restarting" : "Exited"} (${view.exitCode}) ${ago} ago`;
}

export function bindingText(binding: PortBinding): string {
  return `${binding.hostIp || "0.0.0.0"}:${binding.hostPort}->${binding.containerPort}/${binding.proto}`;
}

/** docker ps의 PORTS. 실행 중일 때만 호스트 포트 연결이 보인다. */
export function portsText(container: DockerContainer, view: ContainerView): string {
  return view.status === "running" ? container.ports.map(bindingText).join(", ") : "";
}

/** 이름에서 늘 같은 64자리 16진수 ID를 만든다. 테스트와 화면이 매번 같은 ID를 보게 하려는 것이다. */
export function hexId(seed: string): string {
  let out = "";
  let hash = 2166136261;
  for (let round = 0; out.length < 64; round++) {
    for (const ch of `${seed}#${round}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619) >>> 0;
    out += hash.toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
}

export function isoTime(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, ".000000000Z");
}
