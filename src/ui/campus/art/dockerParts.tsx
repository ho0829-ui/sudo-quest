import type { CSSProperties } from "react";
import { points, project, UNIT, type Point3 } from "../iso";
import { Box, Neon, OnWall, type Tone } from "../parts";
import { useParty } from "../party/context";

export const TEAL = "#26e5c6";
export const WHALE_BLUE = "#2b8cf0";

/** 컨테이너 색 묶음(위·앞·옆). 골판 줄무늬는 앞·옆 면에 어두운 선으로 긋는다. */
export const CONTAINER_TONES: Record<string, Tone> = {
  blue: ["#5eaaff", "#1f6fe0", "#1957b5"],
  teal: ["#7ff2df", "#1fb39b", "#178a78"],
  coral: ["#ffb39a", "#e3684a", "#b8503a"],
  gold: ["#ffe38a", "#d9a92e", "#ad8422"],
  steel: ["#9fb0c2", "#56677a", "#455363"],
};

interface ContainerProps { at: Point3; size: Point3; tone: Tone; doors?: boolean; ribs?: string }

/** 선적 컨테이너. 긴 면(y+d)과 끝면(x+w)에 골판 줄을 긋고, doors면 끝면에 문·잠금 막대를 그린다. */
export function ShippingContainer({ at, size, tone, doors, ribs = "#00000055" }: ContainerProps) {
  const [x, y, z] = at;
  const [w, d, h] = size;
  const longRibs = [];
  for (let rx = x + 0.15; rx < x + w - 0.1; rx += 0.22) {
    longRibs.push(<polyline key={rx} points={points([rx, y + d, z + 0.08], [rx, y + d, z + h - 0.08])} stroke={ribs} strokeWidth={1} />);
  }
  const endRibs = [];
  if (!doors) {
    for (let ry = y + 0.15; ry < y + d - 0.1; ry += 0.22) {
      endRibs.push(<polyline key={ry} points={points([x + w, ry, z + 0.08], [x + w, ry, z + h - 0.08])} stroke={ribs} strokeWidth={1} />);
    }
  }
  return <g>
    <Box at={at} size={size} tone={tone} />
    {longRibs}{endRibs}
    {doors && <OnWall wall="left" at={[x + w, y + d, z + h]}>
      {/* 끝면의 두 짝 문. 왼쪽 벽 변환이라 로컬 x가 -y 방향으로 간다. */}
      <rect x={2} y={3} width={d * UNIT - 4} height={h * UNIT - 6} fill="none" stroke="#0b2a55" strokeWidth={1.2} />
      <line x1={d * UNIT / 2} y1={3} x2={d * UNIT / 2} y2={h * UNIT - 3} stroke="#0b2a55" strokeWidth={1.2} />
      {[0.18, 0.36, 0.64, 0.82].map(f => <line key={f} x1={d * UNIT * f} y1={5} x2={d * UNIT * f} y2={h * UNIT - 5} stroke="#cfe3ff" strokeWidth={1.1} />)}
      {[0.36, 0.64].map(f => <rect key={f} x={d * UNIT * f - 2} y={h * UNIT * 0.55} width={4} height={2.2} fill="#cfe3ff" />)}
    </OnWall>}
  </g>;
}

const SPOUT_DROPS = [[4.5, -25, "#bff7ff"], [13, -29, "#bff7ff"], [20.5, -24, "#bff7ff"]] as const;
const SPOUT_CONFETTI = [[4.5, -25, "#ff5fa2"], [8, -31, "#ffd447"], [13, -29, "#7dff9b"], [17, -33, "#b48bff"], [20.5, -24, "#ff8a3d"], [11, -36, "#ffffff"]] as const;

/**
 * 고래. 물 위로 등과 꼬리만 내놓고 헤엄친다. 등에는 작은 컨테이너를 싣고 있다(도커 고래를 떠올리게 하는
 * 자체 그림이며 공식 로고를 옮긴 것이 아니다). 사람처럼 iso-walker로 왕복하며 돌 때 좌우가 뒤집힌다.
 */
export function Whale({ at, swimTo, water, duration = 16 }: { at: Point3; swimTo: Point3; water: string; duration?: number }) {
  const party = useParty();
  const [x, y] = project(at);
  const [tx, ty] = project(swimTo);
  const style = { "--dx": `${tx - x}px`, "--dy": `${ty - y}px`, animationDuration: `${duration}s` } as CSSProperties;
  return <g transform={`translate(${x},${y})`}>
    <g className="iso-walker" style={style}>
      <ellipse className="iso-ripple" cx={0} cy={3} rx={34} ry={7} fill="none" stroke={TEAL} strokeWidth={1.2} />
      <g className="iso-bob">
        <g className="iso-tail">
          <path d="M-16,-2 C-22,-5 -25,-10 -29,-17 C-25,-16 -22,-14 -20,-11 C-20,-15 -18,-18 -14,-20 C-15,-13 -14,-7 -11,-3 Z" fill="#1f6fd6" />
        </g>
        <path d="M-19,1 C-19,-9 -6,-16 8,-15 C18,-14 25,-8 25,-1 C25,3 21,5 15,5 L-14,5 C-18,5 -19,3 -19,1 Z" fill={WHALE_BLUE} />
        <path d="M-10,3 C0,6 13,6 22,1 C19,5 3,8 -10,3 Z" fill="#cfe6ff" />
        <circle cx={14} cy={-6} r={2} fill="#ffffff" /><circle cx={14.6} cy={-6} r={1} fill="#06243f" />
        {/* 등에 실은 컨테이너 네 개 */}
        {[[-7, -20], [-1, -20], [5, -20], [-1, -26]].map(([cx, cy], i) =>
          <rect key={i} x={cx} y={cy} width={5.4} height={5.4} rx={0.6} fill={i === 3 ? "#7ff2df" : "#d9ecff"} stroke="#1757b0" strokeWidth={0.8} />)}
        {/* 숨구멍 물보라. 파티 중에는 물 대신 꽃가루를 뿜는다. */}
        <g className="iso-spout">
          <path d="M12,-17 q-3,-7 -7,-8 M12,-17 q0,-9 1,-11 M12,-17 q4,-7 8,-7" stroke="#bff7ff" strokeWidth={1.4} fill="none" strokeLinecap="round" />
          {(party ? SPOUT_CONFETTI : SPOUT_DROPS).map(([cx, cy, color]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={party ? 1.5 : 1.3} fill={color} />)}
        </g>
        {/* 물에 잠긴 아랫부분: 물빛으로 덮고 수면 반짝임을 긋는다. */}
        <rect x={-30} y={2} width={58} height={7} fill={water} opacity={0.88} />
        <path d="M-26,2 q5,-2 10,0 t10,0 t10,0 t10,0 t10,0" stroke="#9ff3ff" strokeWidth={0.9} fill="none" opacity={0.8} />
      </g>
    </g>
  </g>;
}

/**
 * 갠트리 크레인. 다리 네 개와 위 보, 오가는 트롤리, 줄에 매달려 오르내리는 컨테이너.
 * x0~x1 구간, y0(벽 쪽)~y1(앞) 위에 선다.
 */
export function GantryCrane({ x0, x1, y0, y1, top }: { x0: number; x1: number; y0: number; y1: number; top: number }) {
  const steel: Tone = ["#5ff0d8", "#159a86", "#0f7b6b"];
  const leg = (x: number, y: number) => <Box key={`${x}-${y}`} at={[x, y, 0]} size={[0.16, 0.16, top]} tone={steel} />;
  const midX = (x0 + x1) / 2;
  const midY = (y0 + y1) / 2;
  const [cx, cy] = project([midX, midY, top]);
  const [, hookY] = project([midX, midY, 3.1]);
  return <g>
    {leg(x0, y0)}{leg(x1, y0)}
    <Box at={[x0, y0, top]} size={[x1 - x0 + 0.16, 0.16, 0.2]} tone={steel} />
    <Box at={[x0, y0, top]} size={[0.16, y1 - y0 + 0.16, 0.2]} tone={steel} />
    <Box at={[x1, y0, top]} size={[0.16, y1 - y0 + 0.16, 0.2]} tone={steel} />
    {/* 줄은 가장 낮은 위치까지 고정해 두고, 짐이 올라가면 짐 몸체가 줄 아랫부분을 가린다. */}
    <line x1={cx} y1={cy} x2={cx} y2={hookY} stroke="#c8d6e0" strokeWidth={1} />
    <g className="iso-lift">
      <ShippingContainer at={[midX - 0.9, midY - 0.45, 2.3]} size={[1.8, 0.9, 0.8]} tone={CONTAINER_TONES.coral} />
    </g>
    <Box at={[midX - 0.35, y0 + 0.1, top + 0.2]} size={[0.7, y1 - y0 - 0.05, 0.3]} tone={["#ffe38a", "#d9a92e", "#ad8422"]} />
    {leg(x0, y1)}{leg(x1, y1)}
    <Box at={[x0, y1, top]} size={[x1 - x0 + 0.16, 0.16, 0.2]} tone={steel} />
    <Neon path={[[x0, y1 + 0.16, top + 0.2], [x1 + 0.16, y1 + 0.16, top + 0.2]]} color={TEAL} width={0.8} />
  </g>;
}
