import type { CSSProperties } from "react";
import { points, project, type Point3 } from "../iso";
import { Box, Cylinder, Neon, OnWall, type Tone } from "../parts";

export const PEACH = "#ff9a6b";
export const WARM_LIGHT = "#ffd08a";
const LIGHT_WOOD: Tone = ["#d9b48a", "#8a5f3b", "#6e4a2d"];
const DARK_WOOD: Tone = ["#7a5034", "#4a2c1a", "#3c2415"];
const CHROME: Tone = ["#eef2f6", "#a3acb6", "#7f8892"];

/** 김. 컵·커피 머신 위로 피어오르며 사라진다. */
export function Steam({ at, delay = 0 }: { at: Point3; delay?: number }) {
  const [x, y] = project(at);
  return <path className="iso-steam" d={`M${x},${y} q-3,-4 0,-8 q3,-4 0,-8`} stroke="#fff4e6" strokeWidth={1.2} fill="none"
    strokeLinecap="round" style={{ animationDelay: `${delay}s` } as CSSProperties} />;
}

/** 머그잔(작은 원기둥)과 김. */
export function Mug({ at, color = "#f4f1ea", steam }: { at: Point3; color?: string; steam?: number }) {
  return <g>
    <Cylinder at={at} r={0.08} h={0.14} tone={[color, "#d9d2c3", "#bfb6a5"]} />
    {steam !== undefined && <Steam at={[at[0], at[1], at[2] + 0.2]} delay={steam} />}
  </g>;
}

/** 바 카운터: 원목 상판, 세로 판재 앞면, 상판 아래 살구색 네온, 에스프레소 머신·진열장·계산대. */
export function Counter({ x, y, w, d }: { x: number; y: number; w: number; d: number }) {
  const top = 1.0;
  const slats = [];
  for (let sx = x + 0.2; sx < x + w; sx += 0.3) slats.push(<polyline key={sx} points={points([sx, y + d, 0.05], [sx, y + d, top - 0.12])} stroke="#3c2415" strokeWidth={1} />);
  return <g>
    <Box at={[x, y, 0]} size={[w, d, top]} tone={DARK_WOOD} />
    {slats}
    <Box at={[x - 0.05, y - 0.05, top]} size={[w + 0.1, d + 0.1, 0.08]} tone={LIGHT_WOOD} />
    <Neon path={[[x, y + d + 0.06, top - 0.08], [x + w, y + d + 0.06, top - 0.08], [x + w + 0.06, y, top - 0.08]]} color={PEACH} width={0.8} />
    {/* 에스프레소 머신: 크롬 몸체, 호박색 표시등, 포터필터, 김 */}
    <Box at={[x + 0.2, y + 0.1, top + 0.08]} size={[0.85, 0.5, 0.55]} tone={CHROME} />
    <Box at={[x + 0.2, y + 0.1, top + 0.63]} size={[0.85, 0.5, 0.06]} tone={["#5a3a22", "#3c2415", "#2e1b10"]} />
    {[0.38, 0.78].map(o => <circle key={o} className="iso-led" cx={project([x + 0.2 + o, y + 0.6, top + 0.5])[0]} cy={project([x + 0.2 + o, y + 0.6, top + 0.5])[1]} r={1.3} fill="#ffb547" />)}
    <Box at={[x + 0.45, y + 0.6, top + 0.25]} size={[0.35, 0.12, 0.06]} tone={["#2e2e2e", "#1a1a1a", "#111111"]} />
    <Mug at={[x + 0.62, y + 0.68, top + 0.08]} steam={0} />
    <Steam at={[x + 0.5, y + 0.3, top + 0.75]} delay={-0.8} />
    {/* 진열장: 유리 너머 빵·케이크 */}
    <Box at={[x + w - 1.45, y + 0.1, top + 0.08]} size={[1.0, 0.6, 0.45]} tone={["#ffffff22", "#ffe9d633", "#ffe9d622"]} />
    {[["#e8a35a", 0.2], ["#c9603f", 0.45], ["#f4d28a", 0.7]].map(([color, o]) => {
      const [cx, cy] = project([x + w - 1.45 + (o as number), y + 0.7, top + 0.22]);
      return <ellipse key={o as number} cx={cx} cy={cy} rx={4} ry={2.6} fill={color as string} />;
    })}
    <Neon path={[[x + w - 1.45, y + 0.7, top + 0.53], [x + w - 0.45, y + 0.7, top + 0.53]]} color={WARM_LIGHT} width={0.6} />
    {/* 계산대 태블릿 */}
    <Box at={[x + w - 0.35, y + 0.25, top + 0.08]} size={[0.25, 0.35, 0.3]} tone={["#2b3542", "#141a22", "#0d1218"]} />
  </g>;
}

/** 둥근 카페 테이블: 다리 하나에 원목 상판, 위에 머그잔. */
export function CafeTable({ at, mugs = [] }: { at: [number, number]; mugs?: [number, number, number?][] }) {
  const [x, y] = at;
  return <g>
    <Cylinder at={[x, y, 0]} r={0.06} h={0.72} tone={["#3c2415", "#2e1b10", "#24150c"]} />
    <Cylinder at={[x, y, 0.72]} r={0.55} h={0.06} tone={LIGHT_WOOD} />
    {mugs.map(([dx, dy, steam], i) => <Mug key={i} at={[x + dx, y + dy, 0.78]} color={i % 2 ? "#ffd0a8" : "#f4f1ea"} steam={steam} />)}
  </g>;
}

/** 등받이 없는 원목 의자. 앉은 사람보다 먼저 그린다. */
export function Stool({ at }: { at: [number, number] }) {
  return <Cylinder at={[at[0], at[1], 0]} r={0.2} h={0.45} tone={["#c48a52", "#7a5034", "#5e3c26"]} />;
}

/** 천장에서 내려온 펜던트 조명. 줄, 갓, 따뜻한 빛 번짐. */
export function PendantLamp({ at, delay = 0 }: { at: [number, number]; delay?: number }) {
  const [x, y] = at;
  const [tx, ty] = project([x, y, 4.7]);
  const [bx, by] = project([x, y, 3.05]);
  return <g>
    <line x1={tx} y1={ty} x2={bx} y2={by} stroke="#1a120c" strokeWidth={0.8} />
    <circle className="iso-warm" cx={bx} cy={by + 8} r={12} fill={WARM_LIGHT} style={{ animationDelay: `${delay}s` }} />
    <path d={`M${bx - 6},${by + 6} L${bx - 2.5},${by} H${bx + 2.5} L${bx + 6},${by + 6} Z`} fill="#2e1b10" stroke={PEACH} strokeWidth={0.6} />
    <circle cx={bx} cy={by + 6.5} r={2.2} fill="#fff1cf" />
  </g>;
}

/** 말풍선. 대화하는 사람 머리 위에 떠올랐다 사라진다(장식). */
export function Bubble({ at, text, delay = 0 }: { at: Point3; text: string; delay?: number }) {
  const [x, y] = project(at);
  const w = Math.max(14, text.length * 4.6 + 6);
  return <g transform={`translate(${x},${y})`}>
    <g className="iso-bubble" style={{ animationDelay: `${delay}s` } as CSSProperties}>
      <rect x={-w / 2} y={-11} width={w} height={10} rx={4} fill="#fff4e6" stroke={PEACH} strokeWidth={0.8} />
      <path d="M-2,-1.2 L0,3 L2,-1.2 Z" fill="#fff4e6" />
      <text x={0} y={-3.8} textAnchor="middle" className="iso-bubble-text">{text}</text>
    </g>
  </g>;
}

/** 소파와 낮잠 자는 고양이. 왼쪽 벽 창문 아래에 둔다. */
export function Sofa({ y0, y1 }: { y0: number; y1: number }) {
  const fabric: Tone = ["#d97a55", "#a4523a", "#87412d"];
  const [cx, cy] = project([0.55, y1 - 0.15, 0.78]);
  return <g>
    <Box at={[0.15, y0, 0.45]} size={[0.32, y1 - y0, 0.55]} tone={fabric} />
    <Box at={[0.15, y0, 0]} size={[0.95, y1 - y0, 0.45]} tone={fabric} />
    {[y0 + 0.15, y0 + (y1 - y0) / 2 + 0.05].map(cy0 => <Box key={cy0} at={[0.45, cy0, 0.45]} size={[0.6, (y1 - y0) / 2 - 0.2, 0.1]} tone={["#f0a07c", "#c4664a", "#a4523a"]} />)}
    <Box at={[0.15, y0 - 0.05, 0.45]} size={[0.95, 0.25, 0.3]} tone={fabric} />
    <Box at={[0.15, y1 - 0.2, 0.45]} size={[0.95, 0.25, 0.3]} tone={fabric} />
    {/* 고양이: 동그랗게 말린 몸, 귀, 꼬리, 떠오르는 z */}
    <g transform={`translate(${cx},${cy})`}>
      <ellipse cx={0} cy={0} rx={7} ry={3.6} fill="#f2a65a" />
      <circle cx={5.5} cy={-1.5} r={3} fill="#f2a65a" />
      <path d="M4,-3.6 l0.8,-2.6 l1.6,2 M6.4,-3.8 l1.2,-2.4 l1,2.4" fill="#f2a65a" stroke="#d98b43" strokeWidth={0.5} />
      <path d="M-6,1 q-4,1 -2,-3" stroke="#d98b43" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      <text className="iso-bubble iso-bubble-text" x={9} y={-7} style={{ animationDelay: "-1s" }}>z</text>
    </g>
  </g>;
}

/** 커뮤니티 게시판: 코르크판에 꽂힌 쪽지·사진, 쪽지를 잇는 빨간 실. 실제 게시판 기능은 준비 중. */
export function CorkBoard({ at }: { at: Point3 }) {
  const notes: [number, number, number, number, string, number, string][] = [
    [6, 12, 17, 12, "#ffe58a", -4, "Q&A"], [26, 11, 16, 13, "#ffb3c7", 3, "스터디"], [45, 13, 19, 11, "#b8f2d6", -2, "장애 후기"],
    [7, 28, 14, 12, "#b8d8ff", 5, ""], [27, 29, 18, 11, "#ffffff", -3, "LGTM"], [49, 27, 14, 14, "#ffd0a8", 2, "TIL"],
  ];
  return <OnWall wall="left" at={at}>
    <rect width={72} height={48} rx={2} fill="#5b3a22" />
    <rect x={3} y={8} width={66} height={37} fill="#c48a52" />
    <text className="iso-board-title" x={5} y={6} fill={PEACH}>커뮤니티 게시판</text>
    <path d="M14,14 Q30,24 34,15 T55,16" stroke="#c43c3c" strokeWidth={0.7} fill="none" strokeDasharray="1.6 1.2" />
    {notes.map(([x, y, w, h, color, rot, label]) => <g key={`${x}-${y}`} transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`}>
      <rect x={x} y={y} width={w} height={h} fill={color} />
      {label
        ? <text x={x + 2} y={y + 5.5} className="iso-note-text">{label}</text>
        : <rect x={x + 2} y={y + 2} width={w - 4} height={h - 5} fill="#7a9cc6" opacity={0.6} />}
      <line x1={x + 2} y1={y + h - 4} x2={x + w - 3} y2={y + h - 4} stroke="#8a7a6a" strokeWidth={0.6} />
      <circle cx={x + w / 2} cy={y + 1} r={1.2} fill={x % 2 ? "#e04646" : "#326ce5"} />
    </g>)}
  </OnWall>;
}

/** 오른쪽 벽 칠판 메뉴판. 장애 대응 말장난 메뉴. */
export function MenuBoard({ at }: { at: Point3 }) {
  const items = [["HOTFIX AMERICANO", "3.0"], ["ROLLBACK LATTE", "4.5"], ["502 MOCHA", "4.0"], ["LGTM TEA", "3.5"]];
  return <OnWall wall="right" at={at}>
    <rect width={70} height={40} rx={2} fill="#5b3a22" />
    <rect x={3} y={3} width={64} height={34} fill="#1f2b24" />
    <text className="iso-board-title" x={7} y={11} fill={WARM_LIGHT}>MENU</text>
    {items.map(([name, price], i) => <g key={name}>
      <text x={7} y={18 + i * 5} className="iso-chalk">{name}</text>
      <text x={58} y={18 + i * 5} className="iso-chalk">{price}</text>
    </g>)}
  </OnWall>;
}
