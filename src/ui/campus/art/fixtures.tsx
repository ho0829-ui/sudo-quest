import { points, project, UNIT, type Point3 } from "../iso";
import { Box, Cylinder, Led, Neon, OnWall, type Tone } from "../parts";

/** 빛을 먹는 건메탈. 랙·장비 몸체의 기본 재질. */
export const GUNMETAL: Tone = ["#2b3542", "#141a22", "#0d1218"];

interface RackProps { x: number; y: number; accent: string; seed: number; w?: number; d?: number; h?: number; rear?: boolean; leds?: string[] }

/**
 * 서버 랙. 관찰자 쪽 면(y+d)에 유닛 줄과 LED를 단다. rear면 뒷면(배선)으로 그린다.
 * 랙 위 모서리와 옆 틈새에 네온 선을 둬서 "선으로 빛나는" 서버룸 조명을 만든다.
 */
export function Rack({ x, y, accent, seed, w = 1.1, d = 1.1, h = 2.3, rear, leds }: RackProps) {
  const face = y + d;
  const rows: number[] = [];
  for (let z = 0.25; z < h - 0.15; z += 0.27) rows.push(z);
  const colors = leds ?? [accent];
  return <g>
    <Box at={[x, y, 0]} size={[w, d, h]} tone={GUNMETAL} />
    {rear
      ? [0, 1, 2, 3].map(k => <polyline key={k} points={points([x + 0.18 + k * 0.24, face, 0.15], [x + 0.18 + k * 0.24, face, h - 0.15])}
          stroke={k === seed % 4 ? accent : "#1e2731"} strokeOpacity={k === seed % 4 ? 0.7 : 1} strokeWidth={1.4} />)
      : rows.map((z, i) => <g key={z}>
          <polyline points={points([x + 0.08, face, z - 0.07], [x + w - 0.08, face, z - 0.07])} stroke="#222b36" strokeWidth={1} />
          <Led at={[x + 0.2, face, z + 0.06]} color={colors[(seed + i) % colors.length]} delay={-(((seed * 7 + i) * 0.37) % 2.4)} r={1.15} />
          {(i + seed) % 3 !== 0 && <Led at={[x + 0.36, face, z + 0.06]} color={colors[(seed + i + 1) % colors.length]} delay={-(((seed + i) * 0.71) % 2.4)} r={1.15} />}
          <polyline points={points([x + 0.55, face, z + 0.06], [x + w - 0.15, face, z + 0.06])} stroke="#2c3744" strokeWidth={2.2} />
        </g>)}
    <Neon path={[[x, face, h], [x + w, face, h]]} color={accent} width={1} />
    <Neon path={[[x + w, face, 0.05], [x + w, face, h]]} color={accent} width={0.6} />
  </g>;
}

/** 책상 위 모니터. 화면은 관찰자 쪽(y+d 면)을 본다. 앞에 앉은 사람은 등을 보인다. */
export function Monitor({ at, w = 0.9, h = 0.55, glow, lines = 3 }: { at: Point3; w?: number; h?: number; glow: string; lines?: number }) {
  const [x, y, z] = at;
  return <g>
    <Box at={[x + w / 2 - 0.05, y, z]} size={[0.1, 0.06, 0.15]} tone={GUNMETAL} />
    <Box at={[x, y, z + 0.15]} size={[w, 0.06, h]} tone={["#2b3542", "#06080c", "#0d1218"]} />
    <OnWall wall="right" at={[x + 0.05, y + 0.061, z + 0.15 + h - 0.05]}>
      <rect className="iso-monitor" width={(w - 0.1) * UNIT} height={(h - 0.1) * UNIT} fill={glow} opacity={0.3} />
      {Array.from({ length: lines }, (_, i) => <rect key={i} x={2} y={2.5 + i * 3.2} width={((w - 0.1) * UNIT - 4) * (0.45 + ((i * 37) % 50) / 100)} height={1.4} fill={glow} />)}
    </OnWall>
  </g>;
}

/** 항온항습기(CRAC). 팬이 돌고 찬 공기가 바닥으로 흐른다. 면 x+w(오른쪽 아래)를 앞면으로 쓴다. */
export function CoolingUnit({ x, y, d = 2.4, h = 2.4, accent }: { x: number; y: number; d?: number; h?: number; accent: string }) {
  const w = 1.0;
  const fans = [y + 0.6, y + d - 0.6];
  return <g>
    <Box at={[x, y, 0]} size={[w, d, h]} tone={["#3a4554", "#1a222c", "#202a36"]} />
    {fans.map(fy => {
      const [cx, cy] = project([x + w, fy, h - 0.7]);
      return <g key={fy} transform={`translate(${cx},${cy}) matrix(0.866,-0.5,0,1,0,0)`}>
        <circle r={9} fill="#0b1016" stroke="#55606f" strokeWidth={1} />
        <g className="iso-fan"><path d="M0,0 L0,-8 A8,8 0 0 1 6,-5Z M0,0 L7,4 A8,8 0 0 1 1,8Z M0,0 L-7,4 A8,8 0 0 1 -7,-4Z" fill="#5fe9ff" opacity={0.6} /></g>
      </g>;
    })}
    {[0.5, 0.8, 1.1].map(z => <polyline key={z} points={points([x + w, y + 0.3, z], [x + w, y + d - 0.3, z])} stroke="#0e141b" strokeWidth={1.4} />)}
    <Neon path={[[x + w, y, h - 0.15], [x + w, y + d, h - 0.15]]} color={accent} width={0.9} />
    {/* 찬 공기: 장비 앞에서 바닥(이중 바닥 아래)으로 흘러 들어간다. */}
    {[0.4, 1.2, 2.0].map(o => <polyline key={o} className="iso-flow iso-air" points={points([x + w + 0.2, y + o, 1.2], [x + w + 0.9, y + o, 0.4], [x + w + 1.4, y + o, 0.02])} stroke="#7fe8ff" strokeWidth={1} fill="none" />)}
  </g>;
}

/** 가스 소화 설비 실린더(빨강). 서버실은 물 대신 가스로 불을 끈다. */
export function GasCylinders({ x, y, count = 2 }: { x: number; y: number; count?: number }) {
  return <g>{Array.from({ length: count }, (_, i) => <g key={i}>
    <Cylinder at={[x, y + i * 0.6, 0]} r={0.24} h={1.5} tone={["#ff6b6b", "#c42a2a", "#9c1d1d"]} />
    <Cylinder at={[x, y + i * 0.6, 1.5]} r={0.08} h={0.18} tone={["#d8dde4", "#8a929d", "#6c7480"]} />
  </g>)}</g>;
}

export function Extinguisher({ at }: { at: Point3 }) {
  return <g><Cylinder at={at} r={0.12} h={0.5} tone={["#ff5a5a", "#d22b2b", "#a51f1f"]} /><Cylinder at={[at[0], at[1], at[2] + 0.5]} r={0.05} h={0.08} tone={GUNMETAL} /></g>;
}

/** 벽 모서리 보안 카메라. 빨간 녹화등이 깜박인다. */
export function Camera({ at }: { at: Point3 }) {
  const [x, y] = project(at);
  return <g transform={`translate(${x},${y})`}>
    <rect x={-2} y={-2} width={4} height={6} fill="#2b3542" />
    <rect x={-1} y={3} width={11} height={5} rx={2} fill="#d6dde6" />
    <circle className="iso-led" cx={9} cy={5.5} r={1.2} fill="#ff3355" />
  </g>;
}

export function Plant({ at, scale = 1 }: { at: Point3; scale?: number }) {
  const [px, py] = project([at[0], at[1], at[2] + 0.55 * scale]);
  return <g>
    <Cylinder at={at} r={0.3 * scale} h={0.55 * scale} tone={["#d9e2f2", "#8d98ab", "#6f7a8c"]} />
    {[[-6, -10, 8], [5, -13, 7], [0, -19, 6.5], [-2, -6, 6]].map(([dx, dy, r], i) =>
      <circle key={i} cx={px + dx * scale} cy={py + dy * scale} r={r * scale} fill={i % 2 ? "#2fbf71" : "#22a35f"} />)}
  </g>;
}
