/**
 * readiness probe 판정. 이미지가 그 포트에서 듣지 않으면 연결 거부, 그 경로가 없으면 404로 실패한다.
 * 실패 문장은 실제 kubelet 이벤트와 같고, 접근 로그를 남기는 앱이면 probe 요청 줄도 계산해 보여 준다.
 */
import type { ContainerSpec, ImageProfile } from "./types";

export type ProbeResult = { ok: true; status?: number } | { ok: false; message: string; status?: number };

export function readiness(spec: ContainerSpec, image: ImageProfile, podIp: string | undefined): ProbeResult {
  const probe = spec.readinessProbe;
  if (!probe) return { ok: true };
  if (!image.ports.includes(probe.port)) {
    const target = `${podIp ?? "<none>"}:${probe.port}`;
    return { ok: false, message: `Readiness probe failed: Get "http://${target}${probe.path}": dial tcp ${target}: connect: connection refused` };
  }
  if (!image.paths.includes(probe.path)) return { ok: false, status: 404, message: "Readiness probe failed: HTTP probe failed with statuscode: 404" };
  return { ok: true, status: 200 };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clf(ms: number): string {
  const d = new Date(ms);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${two(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${two(d.getUTCHours())}:${two(d.getUTCMinutes())}:${two(d.getUTCSeconds())} +0000`;
}

/**
 * 최근 probe 요청 세 번(10초 간격, kubelet 기본 주기)의 접근 로그. 응답 코드는 probe 판정에서 나온다.
 * 포트가 달라 연결 자체가 안 되면 앱에 요청이 닿지 않으므로 줄이 없다.
 */
export function probeAccessLog(spec: ContainerSpec, image: ImageProfile, nodeIp: string, clock: number): string[] {
  const probe = spec.readinessProbe;
  const result = readiness(spec, image, undefined);
  if (!probe || !image.accessLog || result.status === undefined) return [];
  return [20_000, 10_000, 0].map(ago =>
    `${nodeIp} - - [${clf(clock - ago)}] "GET ${probe.path} HTTP/1.1" ${result.status} ${result.status === 200 ? 15 : 19} "-" "kube-probe/1.30"`);
}
