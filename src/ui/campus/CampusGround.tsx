import type { CSSProperties } from "react";
import { plane, points, project, type Point3 } from "./iso";
import { Neon } from "./parts";
import { Person } from "./art/people";

/** 복도. axis는 사람이 지나가는 방향, rank는 이 복도가 이어 주는 앞쪽 방 묶음의 직전 층이다. */
export interface CorridorSpec { x: number; y: number; axis: "x" | "y"; rank: number; walker?: { shirt: string; hair: string }; robot?: boolean }

// 방은 뒤에서 앞으로 0(자료실) → 1(리눅스·네트워크) → 2(관제실) → 3(웹·DB·AWS) 층으로 그린다.
export const CORRIDORS: CorridorSpec[] = [
  { x: 4, y: 10, axis: "y", rank: 0 },
  { x: 10, y: 4, axis: "x", rank: 0, walker: { shirt: "#ffcf8a", hair: "#2a1d18" } },
  { x: 10, y: 16, axis: "x", rank: 1, walker: { shirt: "#00ff66", hair: "#121212" } },
  { x: 16, y: 10, axis: "y", rank: 1, robot: true },
  { x: 16, y: 22, axis: "y", rank: 2, walker: { shirt: "#ff2d95", hair: "#6b4a2f" } },
  { x: 22, y: 16, axis: "x", rank: 2 },
];

/** 바닥 전체에 깔린 트론 격자. 방이 어둠 속 플랫폼 위에 떠 있는 느낌을 준다. */
export function Ground() {
  const lines = [];
  for (let v = -6; v <= 40; v += 2) {
    lines.push(<polyline key={`a${v}`} points={points([v, -6, 0], [v, 40, 0])} />);
    lines.push(<polyline key={`b${v}`} points={points([-6, v, 0], [40, v, 0])} />);
  }
  return <g className="iso-ground">
    <g stroke="#00d4ff" strokeOpacity={0.07} strokeWidth={0.8}>{lines}</g>
    <Neon path={[[-6, 40, 0], [40, 40, 0], [40, -6, 0]]} color="#00d4ff" width={0.6} />
  </g>;
}

/** 순찰 로봇: 작은 몸통과 깜박이는 표시등. 복도를 오간다. */
function Robot({ at, to }: { at: Point3; to: Point3 }) {
  const [x, y] = project(at);
  const [tx, ty] = project(to);
  return <g transform={`translate(${x},${y})`}>
    <g className="iso-walker" style={{ "--dx": `${tx - x}px`, "--dy": `${ty - y}px`, animationDuration: "7s" } as CSSProperties}>
      <ellipse cx={0} cy={0} rx={6} ry={2.5} fill="#000" opacity={0.4} />
      <rect x={-5} y={-11} width={10} height={9} rx={3} fill="#dfe9ff" />
      <rect x={-3.5} y={-9} width={7} height={3} rx={1.5} fill="#05070b" />
      <circle className="iso-led" cx={0} cy={-7.5} r={1} fill="#00d4ff" />
      <rect x={-0.6} y={-15} width={1.2} height={4} fill="#dfe9ff" />
      <circle cx={0} cy={-15.5} r={1.4} fill="#ff7a1a" />
    </g>
  </g>;
}

/** 복도 바닥과 양쪽 네온 가장자리, 가운데 흐르는 신호선, 지나가는 사람·로봇. */
export function Corridor({ spec }: { spec: CorridorSpec }) {
  const { x, y, axis } = spec;
  const along = axis === "y";
  const edgeA: Point3[] = along ? [[x, y, 0.01], [x, y + 2, 0.01]] : [[x, y, 0.01], [x + 2, y, 0.01]];
  const edgeB: Point3[] = along ? [[x + 2, y, 0.01], [x + 2, y + 2, 0.01]] : [[x, y + 2, 0.01], [x + 2, y + 2, 0.01]];
  const start: Point3 = along ? [x + 1, y + 0.2, 0] : [x + 0.2, y + 1, 0];
  const end: Point3 = along ? [x + 1, y + 1.8, 0] : [x + 1.8, y + 1, 0];
  return <g>
    <polygon points={plane(x, y, 2, 2)} fill="#0b1018" />
    <Neon path={edgeA} color="#00d4ff" width={0.7} />
    <Neon path={edgeB} color="#00d4ff" width={0.7} />
    <polyline className="iso-flow" points={points(start, end)} stroke="#00d4ff" strokeOpacity={0.7} strokeWidth={1.1} />
    {spec.walker && <Person at={start} walkTo={end} pose="walk" facing={along ? "left" : "right"} shirt={spec.walker.shirt} hair={spec.walker.hair} />}
    {spec.robot && <Robot at={start} to={end} />}
  </g>;
}
