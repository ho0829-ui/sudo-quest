import type { CSSProperties, ReactNode } from "react";
import { backWalls, box, plane, points, project, UNIT, wallTransform, type Point3 } from "./iso";

/** 위·왼쪽·오른쪽 면 색. 빛이 왼쪽 위에서 온다고 보고 위 > 왼쪽 > 오른쪽 순으로 밝다. */
export type Tone = [top: string, left: string, right: string];

export function Box({ at, size, tone, className }: { at: Point3; size: Point3; tone: Tone; className?: string }) {
  const faces = box(at[0], at[1], at[2], size[0], size[1], size[2]);
  return <g className={className}>
    <polygon points={faces.left} fill={tone[1]} />
    <polygon points={faces.right} fill={tone[2]} />
    <polygon points={faces.top} fill={tone[0]} />
  </g>;
}

/** 바닥. grid를 주면 타일 줄눈을 긋는다(서버실의 이중 바닥 느낌). */
export function Floor({ size, fill, grid }: { size: number; fill: string; grid?: string }) {
  const lines: ReactNode[] = [];
  if (grid) {
    for (let i = 1; i < size; i++) {
      lines.push(<polyline key={`x${i}`} points={points([i, 0, 0], [i, size, 0])} stroke={grid} strokeWidth={0.6} fill="none" />);
      lines.push(<polyline key={`y${i}`} points={points([0, i, 0], [size, i, 0])} stroke={grid} strokeWidth={0.6} fill="none" />);
    }
  }
  return <g><polygon points={plane(0, 0, size, size)} fill={fill} />{lines}</g>;
}

export function Walls({ size, height, left, right, trim }: { size: number; height: number; left: string; right: string; trim: string }) {
  const walls = backWalls(0, 0, size, size, height);
  return <g>
    <polygon points={walls.left} fill={left} />
    <polygon points={walls.right} fill={right} />
    {/* 벽 윗선·세로 모서리·걸레받이를 네온으로 그어 모듈형 방의 윤곽을 닫는다.
        세로선이 빠지면 윗선만 떠 있어 상자가 그리다 만 것처럼 보인다. */}
    <Neon path={[[0, size, 0], [0, size, height], [0, 0, height], [size, 0, height], [size, 0, 0]]} color={trim} width={1.8} />
    <Neon path={[[0, 0, 0], [0, 0, height]]} color={trim} width={1.4} />
    <Neon path={[[0, size, 0.06], [0, 0, 0.06], [size, 0, 0.06]]} color={trim} width={0.9} />
  </g>;
}

/** 벽에 칠한 글씨나 그림. children은 (0,0) 기준 평면 좌표로 그린다. */
export function OnWall({ wall, at, children }: { wall: "left" | "right"; at: Point3; children: ReactNode }) {
  return <g transform={wallTransform(wall, at)}>{children}</g>;
}

/** 바닥 위 원기둥(DB 디스크, 화분, 경보등 몸통). */
export function Cylinder({ at, r, h, tone }: { at: Point3; r: number; h: number; tone: Tone }) {
  const [cx, cyBottom] = project(at);
  const cyTop = cyBottom - h * UNIT;
  const rx = r * Math.SQRT2 * Math.cos(Math.PI / 6) * UNIT;
  const ry = r * Math.SQRT2 * 0.5 * UNIT;
  return <g>
    <ellipse cx={cx} cy={cyBottom} rx={rx} ry={ry} fill={tone[2]} />
    <rect x={cx - rx} y={cyTop} width={rx} height={cyBottom - cyTop} fill={tone[1]} />
    <rect x={cx} y={cyTop} width={rx} height={cyBottom - cyTop} fill={tone[2]} />
    <ellipse cx={cx} cy={cyTop} rx={rx} ry={ry} fill={tone[0]} />
  </g>;
}

/** 깜박이는 LED. delay를 다르게 주면 랙마다 리듬이 달라진다. */
export function Led({ at, color, delay = 0, r = 1.6 }: { at: Point3; color: string; delay?: number; r?: number }) {
  const [x, y] = project(at);
  return <circle className="iso-led" cx={x} cy={y} r={r} fill={color} style={{ animationDelay: `${delay}s` } as CSSProperties} />;
}

/**
 * 네온 선 조명. 면을 칠하지 않고 선으로만 빛나게 해야 사이버 서버룸 느낌이 난다.
 * 필터(blur) 대신 굵고 옅은 선을 한 번 더 그려 번짐을 흉내 낸다(가볍다).
 */
export function Neon({ path, color, width = 1.3, flow }: { path: Point3[]; color: string; width?: number; flow?: boolean }) {
  const p = points(...path);
  return <g>
    <polyline points={p} stroke={color} strokeWidth={width * 4.5} opacity={0.16} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points={p} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" className={flow ? "iso-flow" : undefined} />
  </g>;
}

/** 공간 좌표 두 점을 잇는 선(케이블, 광섬유). flow면 점선이 흐른다. */
export function Wire({ from, to, color, flow, width = 1.4, bend = 0 }: {
  from: Point3; to: Point3; color: string; flow?: boolean; width?: number; bend?: number;
}) {
  const [x1, y1] = project(from);
  const [x2, y2] = project(to);
  const d = `M${x1},${y1} Q${(x1 + x2) / 2},${(y1 + y2) / 2 + bend} ${x2},${y2}`;
  return <path d={d} stroke={color} strokeWidth={width} fill="none" strokeLinecap="round" className={flow ? "iso-flow" : undefined} />;
}
