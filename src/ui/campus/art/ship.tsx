import type { ReactNode } from "react";
import { points, project, UNIT, type Point3 } from "../iso";
import { Box, Neon, OnWall, type Tone } from "../parts";

export const BRASS = "#ffd447";
const ROPE = "#d9c49a";
export const WOOD: Tone = ["#9a7046", "#4a2f1c", "#3e2716"];

/** 배의 치수(방 좌표). 선미 S → 어깨 X → 뱃머리 B, 폭 y0~y1, 갑판 높이 D, 물 높이 W. */
export const SHIP = { S: 1.3, X: 7.3, B: 8.9, y0: 3.6, y1: 6.4, yc: 5.0, D: 1.25, W: 0.05 } as const;

/** 선체: 좌현 뱃머리(어둡게) → 우현 옆판 → 우현 뱃머리 → 갑판 순으로 칠해 앞면이 뒤를 덮게 한다. */
export function Hull() {
  const { S, X, B, y0, y1, yc, D, W } = SHIP;
  const planks = [0.45, 0.85].map(z => {
    const inset = 0.3 * (D - z) / (D - W);
    return <polyline key={z} points={points([S + 0.2, y1 - inset, z], [X, y1 - inset, z], [B - 0.4 * (z / D), yc, z + 0.1])} stroke="#2a1a0f" strokeWidth={1} fill="none" />;
  });
  return <g>
    <polygon points={points([X, y0, D], [B, yc, D + 0.25], [8.2, yc, W], [X - 0.1, y0 + 0.3, W])} fill="#2a1a0f" />
    <polygon points={points([S, y1, D], [X, y1, D], [X - 0.1, y1 - 0.3, W], [S + 0.3, y1 - 0.3, W])} fill="#4a2f1c" />
    <polygon points={points([X, y1, D], [B, yc, D + 0.25], [8.2, yc, W], [X - 0.1, y1 - 0.3, W])} fill="#3e2716" />
    {planks}
    {/* 우현 현창: 배 안 램프 불빛(장식) */}
    {[2.3, 3.3, 4.3, 5.3, 6.3].map(x => {
      const [cx, cy] = project([x, y1 - 0.12, 0.72]);
      return <circle key={x} className="iso-lamp" cx={cx} cy={cy} r={2.6} fill={BRASS} style={{ animationDelay: `${-x * 0.4}s` }} />;
    })}
    <polygon points={points([S, y0, D], [X, y0, D], [B, yc, D + 0.25], [X, y1, D], [S, y1, D])} fill="#8a6440" />
    {[3.95, 4.3, 4.65, 5.0, 5.35, 5.7, 6.05].map(y => <polyline key={y} points={points([S, y, D], [X, y, D])} stroke="#6b4a2d" strokeWidth={0.7} />)}
    <Neon path={[[S, y1, D + 0.03], [X, y1, D + 0.03], [B, yc, D + 0.28]]} color={BRASS} width={0.9} />
    {/* 물에 닿는 흰 물거품 */}
    <polyline points={points([S + 0.3, y1 - 0.25, W], [X - 0.1, y1 - 0.25, W], [8.2, yc + 0.1, W])} stroke="#e6f4ff" strokeWidth={1.6} strokeDasharray="3 4" fill="none" opacity={0.7} />
  </g>;
}

/** 돛. 돛대 바로 앞 x 평면에 걸리고, 가운데가 바람에 부푼 것처럼 옆선을 휜다. */
export function Sail({ x, zTop, width, height, emblem }: { x: number; zTop: number; width: number; height: number; emblem?: boolean }) {
  const w = width * UNIT;
  const h = height * UNIT;
  const left = SHIP.yc + width / 2;
  return <OnWall wall="left" at={[x, left, zTop]}>
    <line x1={-4} y1={0} x2={w + 4} y2={0} stroke="#3e2716" strokeWidth={2.4} />
    <path className="iso-sail" d={`M1,1 H${w - 1} Q${w + 4},${h / 2} ${w - 3},${h} H3 Q-4,${h / 2} 1,1 Z`} fill="#f1e6cf" stroke="#cdbb95" strokeWidth={0.8} />
    {[0.33, 0.66].map(f => <line key={f} x1={2} y1={h * f} x2={w - 2} y2={h * f} stroke="#d8c7a1" strokeWidth={0.7} />)}
    {emblem && <g transform={`translate(${w / 2},${h / 2})`}><HelmSymbol r={h * 0.28} color={BRASS} /></g>}
  </OnWall>;
}

/** 일곱 살 조타륜 무늬(쿠버네티스를 떠올리게 하는 자체 그림). 돛·깃발·벽 장식에 쓴다. */
export function HelmSymbol({ r, color, hub }: { r: number; color: string; hub?: string }) {
  const spokes = Array.from({ length: 7 }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7;
    return <g key={k}>
      <line x1={0} y1={0} x2={Math.cos(a) * r * 1.3} y2={Math.sin(a) * r * 1.3} stroke={color} strokeWidth={r * 0.16} strokeLinecap="round" />
      <circle cx={Math.cos(a) * r * 1.32} cy={Math.sin(a) * r * 1.32} r={r * 0.12} fill={color} />
    </g>;
  });
  const hept = Array.from({ length: 7 }, (_, k) => {
    const a = -Math.PI / 2 + (k * 2 * Math.PI) / 7;
    return `${(Math.cos(a) * r * 0.42).toFixed(1)},${(Math.sin(a) * r * 0.42).toFixed(1)}`;
  }).join(" ");
  return <g>
    {spokes}
    <circle r={r} fill="none" stroke={color} strokeWidth={r * 0.18} />
    <polygon points={hept} fill={hub ?? color} stroke={color} strokeWidth={r * 0.06} />
  </g>;
}

/** 조타륜: 받침대 위 x 평면에 세운다. 바퀴통은 쿠버네티스 파랑. */
export function HelmWheel({ at }: { at: Point3 }) {
  const [x, y, z] = at;
  return <g>
    <Box at={[x - 0.07, y - 0.08, z - 0.75]} size={[0.14, 0.16, 0.6]} tone={WOOD} />
    <OnWall wall="left" at={[x, y, z]}>
      <HelmSymbol r={11} color="#c9a24a" hub="#326ce5" />
    </OnWall>
  </g>;
}

/** 망대: 뒤쪽 테 → 안에 선 사람(children) → 앞쪽 몸통 순으로 그려 사람 다리를 가린다. */
export function CrowsNest({ at, children }: { at: Point3; children: ReactNode }) {
  const [cx, cy] = project(at);
  const [, top] = project([at[0], at[1], at[2] + 0.35]);
  const rx = 0.36 * Math.SQRT2 * Math.cos(Math.PI / 6) * UNIT;
  const ry = 0.36 * Math.SQRT2 * 0.5 * UNIT;
  return <g>
    <ellipse cx={cx} cy={top} rx={rx} ry={ry} fill="#2a1a0f" />
    {children}
    <path d={`M${cx - rx},${top} V${cy} A${rx},${ry} 0 0 0 ${cx + rx},${cy} V${top} A${rx},${ry} 0 0 1 ${cx - rx},${top} Z`} fill="#5a3a22" />
    <path d={`M${cx - rx},${top} A${rx},${ry} 0 0 0 ${cx + rx},${top}`} fill="none" stroke={BRASS} strokeWidth={1} />
  </g>;
}

/** 돛대 꼭대기 깃발. 배가 나아가는 반대쪽(-x)으로 나부낀다. */
export function PirateFlag({ at }: { at: Point3 }) {
  return <OnWall wall="right" at={at}>
    <g className="iso-flag">
      <path d="M0,0 L-24,1 Q-21,7 -25,13 L0,12 Z" fill="#14110c" stroke="#3a3025" strokeWidth={0.6} />
      <g transform="translate(-12,6.5)"><HelmSymbol r={3.2} color="#f4f1ea" /></g>
    </g>
  </OnWall>;
}

/** 밧줄. 돛대 꼭대기에서 선수·선미·뱃전으로 내려온다. */
export function Rigging({ lines }: { lines: [Point3, Point3][] }) {
  return <g>{lines.map(([a, b], i) => <polyline key={i} points={points(a, b)} stroke={ROPE} strokeWidth={0.7} opacity={0.65} />)}</g>;
}
