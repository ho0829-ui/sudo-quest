/**
 * 파티 장식 부품: 깃발 줄, 전구 줄, 풍선, 꽃가루, 벽 현수막, 파티 테이블, 케이크, 시작 연출(축포).
 * 모두 공간 좌표(Point3)를 받아 아이소메트릭으로 그린다. 움직임은 CSS 애니메이션이라 모션 끄기·줄이기 설정을 따른다.
 */
import type { CSSProperties, ReactNode } from "react";
import { project, type Point3 } from "../iso";
import { Box, Cylinder, OnWall, type Tone } from "../parts";

export const CONFETTI = ["#ff5fa2", "#ffd447", "#5cc8ff", "#7dff9b", "#b48bff", "#ff8a3d", "#ffffff"];

/** 두 점 사이를 처지게 잇는 줄 위의 점들. 가운데가 sag만큼 내려온다. */
function sagging(from: Point3, to: Point3, count: number, sag: number): Point3[] {
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count;
    return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t - sag * Math.sin(Math.PI * t)];
  });
}

/** 삼각 깃발 줄(만국기). */
export function Garland({ from, to, colors = CONFETTI, count = 12, sag = 0.5 }: { from: Point3; to: Point3; colors?: string[]; count?: number; sag?: number }) {
  const line = sagging(from, to, count, sag).map(project);
  return <g>
    <polyline points={line.map(p => p.join(",")).join(" ")} stroke="#e8e2d0" strokeWidth={0.7} fill="none" opacity={0.8} />
    {line.slice(0, -1).map(([x, y], i) => {
      const [nx, ny] = line[i + 1];
      return <path key={i} className="iso-flag" style={{ animationDelay: `${-i * 0.23}s` } as CSSProperties}
        d={`M${x},${y} L${nx},${ny} L${(x + nx) / 2},${(y + ny) / 2 + 7}z`} fill={colors[i % colors.length]} opacity={0.92} />;
    })}
  </g>;
}

/** 전구 줄. 전구마다 깜빡이는 박자를 다르게 준다. */
export function StringLights({ from, to, colors, count = 14, sag = 0.35 }: { from: Point3; to: Point3; colors: string[]; count?: number; sag?: number }) {
  const line = sagging(from, to, count, sag).map(project);
  return <g>
    <polyline points={line.map(p => p.join(",")).join(" ")} stroke="#1c2430" strokeWidth={0.8} fill="none" />
    {line.map(([x, y], i) => <g key={i}>
      <circle cx={x} cy={y + 2.2} r={3.6} fill={colors[i % colors.length]} opacity={0.18} />
      <circle className="iso-led" cx={x} cy={y + 2.2} r={1.5} fill={colors[i % colors.length]} style={{ animationDelay: `${-i * 0.37}s` } as CSSProperties} />
    </g>)}
  </g>;
}

/** 실에 매달린 풍선. label이 있으면 몸통에 작은 글씨를 쓴다(리전 이름 등). */
export function Balloon({ at, color, label, delay = 0, size = 1 }: { at: Point3; color: string; label?: string; delay?: number; size?: number }) {
  const [x, y] = project(at);
  const r = 6.5 * size;
  return <g className="iso-balloon" style={{ animationDelay: `${delay}s` } as CSSProperties}>
    <path d={`M${x},${y + r * 1.2} q-3,8 1,14 q3,6 -1,12`} stroke="#d9d4c4" strokeWidth={0.6} fill="none" />
    <ellipse cx={x} cy={y} rx={r} ry={r * 1.2} fill={color} />
    <ellipse cx={x - r * 0.35} cy={y - r * 0.45} rx={r * 0.22} ry={r * 0.35} fill="#ffffff" opacity={0.55} />
    <path d={`M${x - 1.6},${y + r * 1.2 + 1.6} h3.2 l-1.6,-2z`} fill={color} />
    {label && <text x={x} y={y + 1.6} textAnchor="middle" className="iso-party-tiny" fill="#ffffff">{label}</text>}
  </g>;
}

/** 공중에서 천천히 떨어지는 꽃가루. 위치는 seed로 정해 매번 같다. */
export function Confetti({ area, z, count = 18, seed = 1, colors = CONFETTI }: { area: [x: number, y: number, w: number, d: number]; z: number; count?: number; seed?: number; colors?: string[] }) {
  const [ax, ay, w, d] = area;
  return <g>{Array.from({ length: count }, (_, i) => {
    const r1 = ((i + 1) * 9301 * seed + 49297) % 233280 / 233280;
    const r2 = ((i + 7) * 7919 * seed + 104729) % 233280 / 233280;
    const [x, y] = project([ax + r1 * w, ay + r2 * d, z]);
    return <rect key={i} className="iso-confetti" x={x} y={y} width={2.4} height={1.3} fill={colors[i % colors.length]}
      style={{ animationDelay: `${-(r1 * 4).toFixed(2)}s`, animationDuration: `${3 + r2 * 2}s` } as CSSProperties} />;
  })}</g>;
}

/** 벽 현수막. */
export function WallBanner({ wall, at, width, text, bg, fg }: { wall: "left" | "right"; at: Point3; width: number; text: string; bg: string; fg: string }) {
  return <OnWall wall={wall} at={at}>
    <g className="iso-banner">
      <rect width={width} height={13} rx={2} fill={bg} />
      <path d={`M0,13 l5,0 l-5,5z M${width},13 l-5,0 l5,5z`} fill={bg} opacity={0.7} />
      <text x={width / 2} y={9} textAnchor="middle" className="iso-party-banner" fill={fg}>{text}</text>
    </g>
  </OnWall>;
}

/** 천을 덮은 파티 테이블. */
export function PartyTable({ at, size, cloth }: { at: Point3; size: [w: number, d: number]; cloth: Tone }) {
  return <g>
    <Box at={[at[0] + 0.1, at[1] + 0.1, 0]} size={[size[0] - 0.2, size[1] - 0.2, 0.62]} tone={["#2b2230", "#1b151f", "#140f17"]} />
    <Box at={[at[0], at[1], 0.62]} size={[size[0], size[1], 0.1]} tone={cloth} />
  </g>;
}

/** 2단 케이크. candle="cursor"면 초 대신 깜빡이는 터미널 커서를 꽂는다. */
export function Cake({ at, cream = "#fff4e6", band = "#ff5fa2", candle = "flame" }: { at: Point3; cream?: string; band?: string; candle?: "flame" | "cursor" }) {
  const [x, y] = project([at[0], at[1], at[2] + 0.75]);
  return <g>
    <Cylinder at={at} r={0.42} h={0.3} tone={[cream, "#e9d7c0", "#d8c3a8"]} />
    <Cylinder at={[at[0], at[1], at[2] + 0.18]} r={0.43} h={0.05} tone={[band, band, band]} />
    <Cylinder at={[at[0], at[1], at[2] + 0.3]} r={0.28} h={0.25} tone={[cream, "#e9d7c0", "#d8c3a8"]} />
    {candle === "cursor"
      ? <rect className="iso-cursor" x={x - 1.6} y={y - 3} width={3.2} height={5} fill="#00ff66" />
      : <g><rect x={x - 0.7} y={y - 2} width={1.4} height={5} fill="#ffd6ea" /><ellipse className="iso-flame" cx={x} cy={y - 3.6} rx={1.4} ry={2.4} fill="#ffd447" /></g>}
  </g>;
}

/**
 * 시작 연출: 방 가운데에서 꽃가루가 한 번 크게 터지고 방 전체가 한 번 밝아진다.
 * 평소에는 숨어 있고, 방에 is-kickoff가 붙었을 때만 CSS가 한 번 재생한다.
 */
export function KickoffBurst({ center, color }: { center: Point3; color: string }) {
  const [cx, cy] = project(center);
  const pieces: ReactNode[] = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2;
    const reach = 60 + (i % 5) * 14;
    return <rect key={i} className="party-burst-piece" x={cx} y={cy} width={4} height={2.2} fill={CONFETTI[i % CONFETTI.length]}
      style={{ "--bx": `${Math.cos(angle) * reach}px`, "--by": `${Math.sin(angle) * reach * 0.6 - 30}px`, animationDelay: `${(i % 4) * 0.05}s` } as CSSProperties} />;
  });
  return <g className="party-burst" aria-hidden="true">
    <circle className="party-burst-flash" cx={cx} cy={cy} r={120} fill={color} />
    {pieces}
  </g>;
}
