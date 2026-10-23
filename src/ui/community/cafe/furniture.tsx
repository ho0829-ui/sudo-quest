/**
 * 손님과 앞뒤를 섞어 그리는 가구·배경 직원. 아이소메트릭은 뒤→앞 순서로 그려야 겹침이 맞으므로
 * 각자 바닥 위치(x+y)를 깊이로 돌려주고, CafeScene이 손님과 함께 정렬한다.
 * 긴 장테이블은 한 덩어리로 정렬하면 양 끝에서 앞뒤가 틀리므로 조각으로 나눠 각 조각의 깊이를 쓴다.
 */
import type { ReactNode } from "react";
import { points } from "../../campus/iso";
import { Box, Cylinder, OnWall, type Tone } from "../../campus/parts";
import { CafeTable, Mug, Stool } from "../../campus/art/cafe";
import { Plant } from "../../campus/art/fixtures";
import { Person } from "../../campus/art/people";
import { Cake } from "../../campus/party/parts";
import { BLOCKS, LONG_TABLE, SPOTS, STANDING, TABLES } from "./floor";
import { STAFF } from "./staff";

export interface Drawable { depth: number; node: ReactNode }

const WOOD: Tone = ["#d9b48a", "#8a5f3b", "#6e4a2d"];
const LEG: Tone = ["#3c2415", "#2e1b10", "#24150c"];
const PLANTS: [number, number][] = [[21.4, 13.3], [0.7, 13.4], [13.9, 13.3]];
const GLASS = "#bfe6fa";

/** 장테이블 조각: 상판 조각과(첫·끝 조각엔) 다리. */
function longTableChunks(party: boolean): Drawable[] {
  const { x, y, w, d } = LONG_TABLE;
  const pieces = 6;
  const step = w / pieces;
  return Array.from({ length: pieces }, (_, i) => {
    const cx = x + i * step;
    return { depth: cx + step / 2 + y + d / 2, node: <g key={`long-${i}`}>
      {(i === 0 || i === pieces - 1) && <Box at={[i ? cx + step - 0.25 : cx + 0.15, y + 0.3, 0]} size={[0.1, d - 0.6, 0.72]} tone={LEG} />}
      <Box at={[cx, y, 0.72]} size={[step, d, 0.08]} tone={WOOD} />
      {i % 2 === 0 && <Mug at={[cx + step / 2, y + 0.3, 0.8]} color="#ffd0a8" steam={-i} />}
      {party && i === 2 && <Cake at={[cx + step, y + d / 2, 0.8]} band="#ff9a6b" />}
    </g> };
  });
}

/** 회의 부스: 유리 칸막이 안의 테이블. 뒤쪽 유리·탁자는 직원보다 먼저, 앞쪽 유리는 나중에 그려야 해서 두 조각이다. */
function booth(): Drawable[] {
  const [x, y, w, d] = BLOCKS.booth;
  const h = 2.3;
  return [
    { depth: x + y, node: <g key="booth-back">
      <polygon points={points([x, y, 0], [x + w, y, 0], [x + w, y + d, 0], [x, y + d, 0])} fill="#3a2a2a" opacity={0.6} />
      <polygon points={points([x, y, 0], [x + w, y, 0], [x + w, y, h], [x, y, h])} fill={GLASS} opacity={0.14} stroke={GLASS} strokeOpacity={0.5} />
      <polygon points={points([x, y, 0], [x, y + d, 0], [x, y + d, h], [x, y, h])} fill={GLASS} opacity={0.14} stroke={GLASS} strokeOpacity={0.5} />
      <OnWall wall="right" at={[x + 0.2, y, h - 0.1]}><text className="cafe-glass-text" y={6}>MEETING</text></OnWall>
    </g> },
    // 탁자는 북쪽(뒤)에 앉은 직원보다 나중, 남쪽(앞) 직원보다 먼저 그린다.
    { depth: x + w / 2 + y + d / 2 + 0.15, node: <g key="booth-table">
      <Box at={[x + 0.7, y + 0.9, 0]} size={[1.6, 0.8, 0.75]} tone={["#e9eef2", "#a3acb6", "#7f8892"]} />
      <Box at={[x + 1.1, y + 1.05, 0.75]} size={[0.6, 0.4, 0.04]} tone={["#2b3542", "#141a22", "#0d1218"]} />
    </g> },
    { depth: x + w + y + d, node: <g key="booth-front">
      <polygon points={points([x, y + d, 0], [x + w, y + d, 0], [x + w, y + d, h], [x, y + d, h])} fill={GLASS} opacity={0.1} stroke={GLASS} strokeOpacity={0.6} />
      <polygon points={points([x + w, y, 0], [x + w, y + d, 0], [x + w, y + d, h], [x + w, y, h])} fill={GLASS} opacity={0.1} stroke={GLASS} strokeOpacity={0.6} />
      <polyline points={points([x, y + d, h], [x + w, y + d, h], [x + w, y, h])} stroke={GLASS} strokeWidth={1.2} fill="none" />
    </g> },
  ];
}

export function cafeDrawables(party: boolean): Drawable[] {
  return [
    // 손님 의자: 그 의자에 앉은 사람보다 살짝 먼저
    ...SPOTS.filter(s => s.kind === "seat").map(s => ({ depth: s.x + s.y - 0.05, node: <Stool key={s.id} at={[s.x, s.y]} /> })),
    ...TABLES.map(([x, y], i) => ({ depth: x + y, node: <CafeTable key={`t${i}`} at={[x, y]} mugs={i % 2 ? [[0.2, -0.1, -i]] : [[-0.2, 0.1], [0.2, -0.15, -i]]} /> })),
    ...longTableChunks(party),
    ...booth(),
    ...STANDING.map(([x, y]) => ({ depth: x + y, node: <g key={`stand-${x}-${y}`}>
      <Cylinder at={[x, y, 0]} r={0.05} h={1.05} tone={LEG} />
      <Cylinder at={[x, y, 1.05]} r={0.35} h={0.05} tone={WOOD} />
      <Mug at={[x + 0.1, y - 0.05, 1.1]} steam={-x} />
    </g> })),
    ...PLANTS.map(([x, y]) => ({ depth: x + y, node: <Plant key={`p${x}-${y}`} at={[x, y, 0]} scale={1.1} /> })),
    ...STAFF.map((m, i) => ({ depth: m.at[0] + m.at[1] + (m.walkTo ? (m.walkTo[0] - m.at[0] + m.walkTo[1] - m.at[1]) / 2 : 0), node: <g key={`staff-${i}`}>
      {m.stool && <Stool at={[m.at[0], m.at[1]]} />}
      <Person {...m} />
    </g> })),
  ];
}
