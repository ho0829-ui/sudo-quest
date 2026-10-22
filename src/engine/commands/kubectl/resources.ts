export const RESOURCE_ALIASES = {
  pod: "pods", pods: "pods", po: "pods",
  deployment: "deployments", deployments: "deployments", deploy: "deployments",
  service: "services", services: "services", svc: "services",
  endpoints: "endpoints", ep: "endpoints",
  endpointslice: "endpointslices", endpointslices: "endpointslices",
  event: "events", events: "events", ev: "events",
  node: "nodes", nodes: "nodes", no: "nodes",
} as const;
export type Resource = (typeof RESOURCE_ALIASES)[keyof typeof RESOURCE_ALIASES];

export function resourceOf(name: string): Resource | undefined {
  return Object.hasOwn(RESOURCE_ALIASES, name) ? RESOURCE_ALIASES[name as keyof typeof RESOURCE_ALIASES] : undefined;
}

export const notFound = (resource: string, name: string): string =>
  `Error from server (NotFound): ${resource} "${name}" not found`;

/** kubectl의 AGE 표기. 이틀이 넘으면 일 단위(5d, 3d4h)로 바꾼다(kubectl HumanDuration과 같은 경계). */
export function age(createdAt: number, clock: number): string {
  const seconds = Math.max(0, Math.floor((clock - createdAt) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return hours % 24 && days < 8 ? `${days}d${hours % 24}h` : `${days}d`;
}

export const labels = (values: Record<string, string>): string =>
  Object.entries(values).map(([k, v]) => `${k}=${v}`).join(",") || "<none>";

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => (r[i] ?? "").length)));
  return [headers, ...rows].map(row => row.map((cell, i) => cell.padEnd(widths[i])).join("   ").trimEnd()).join("\n");
}

/** deployment/NAME, deploy/NAME 형식에서 이름만. 다른 형식이면 undefined. */
export function deploymentName(target: string | undefined): string | undefined {
  const parts = target?.split("/");
  return parts?.length === 2 && resourceOf(parts[0]) === "deployments" && parts[1] ? parts[1] : undefined;
}
