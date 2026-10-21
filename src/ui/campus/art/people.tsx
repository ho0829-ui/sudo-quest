import type { CSSProperties } from "react";
import { project, type Point3 } from "../iso";

/**
 * 근무 중인 사람. 작은 2.5D 인형처럼 화면 좌표로 그린다(발 위치만 공간 좌표에서 투영).
 * 얼굴 표정은 그리지 않는다. 멀리서 보는 관제 지도라 실루엣과 옷 색으로 구분한다.
 */
export type Pose = "stand" | "sit" | "type" | "walk";
export type Facing = "left" | "right" | "away-left" | "away-right";

export interface PersonProps {
  at: Point3;
  facing?: Facing;
  pose?: Pose;
  shirt: string;
  pants?: string;
  skin?: string;
  hair?: string;
  /** 손에 든 것. 태블릿·노트북·머그잔 */
  prop?: "tablet" | "laptop" | "mug";
  /** walk일 때 왕복할 공간 좌표상 이동량 */
  walkTo?: Point3;
  delay?: number;
  /** 왕복 한 번에 걸리는 초. 사람마다 다르게 줘서 걸음이 맞아떨어지지 않게 한다. */
  duration?: number;
}

export function Person({ at, facing = "left", pose = "stand", shirt, pants = "#1d2433", skin = "#f2c9a0", hair = "#2a1d18", prop, walkTo, delay = 0, duration }: PersonProps) {
  const [x, y] = project(at);
  const away = facing.startsWith("away");
  // 기본 그림은 오른쪽 아래를 본다. 왼쪽을 보면 좌우를 뒤집는다.
  const flip = facing === "left" || facing === "away-left" ? -1 : 1;
  const seated = pose === "sit" || pose === "type";
  const walk = pose === "walk" && walkTo ? project(walkTo) : null;
  const style = {
    animationDelay: `${delay}s`,
    ...(duration ? { animationDuration: `${duration}s` } : {}),
    ...(walk ? { "--dx": `${walk[0] - x}px`, "--dy": `${walk[1] - y}px` } : {}),
  } as CSSProperties;

  const hip = seated ? -11 : -15;
  const shoulder = hip - 14;
  const head = shoulder - 6;

  return <g transform={`translate(${x},${y})`}>
    <g className={walk ? "iso-walker" : undefined} style={style}>
      <ellipse cx={0} cy={0} rx={7.5} ry={3} fill="#000" opacity={0.35} />
      <g transform={`scale(${flip},1)`}>
        {seated
          ? <g fill={pants}>
              {/* 앉은 자세: 허벅지는 앞으로, 정강이는 아래로. */}
              <rect x={-3} y={hip} width={10} height={3.6} rx={1.4} />
              <rect x={4} y={hip} width={3.4} height={-hip} rx={1.2} />
            </g>
          : <g className={pose === "walk" ? "iso-legs" : undefined}>
              <rect x={-4} y={hip} width={3.6} height={-hip} rx={1.2} fill={pants} />
              <rect x={0.6} y={hip} width={3.6} height={-hip} rx={1.2} fill={pants} />
            </g>}
        <rect x={-6} y={shoulder} width={12} height={15} rx={4} fill={shirt} />
        {/* 팔: 타이핑 중이면 앞으로 뻗어 살짝 흔든다. */}
        {pose === "type"
          ? <rect className="iso-typing" x={2} y={shoulder + 6} width={9} height={3.2} rx={1.5} fill={shirt} style={{ animationDelay: `${delay}s` }} />
          : <rect x={4.2} y={shoulder + 2} width={3.4} height={11} rx={1.6} fill={shirt} />}
        <circle cx={0} cy={head} r={5.2} fill={skin} />
        {away
          ? <circle cx={0} cy={head - 0.6} r={5.4} fill={hair} />
          : <path d={`M-5.4,${head} a5.4,5.4 0 0 1 10.8,0 q-3,-2 -6,-1.4 q-2.6,.6 -4.8,1.4z`} fill={hair} />}
        {prop === "tablet" && <rect x={6} y={shoulder + 5} width={6} height={8} rx={1} fill="#c9f4ff" stroke="#00d4ff" strokeWidth={0.8} />}
        {prop === "laptop" && <rect x={4} y={shoulder + 9} width={10} height={6} rx={1} fill="#9aa7b8" />}
        {prop === "mug" && <rect x={7} y={shoulder + 7} width={3.5} height={4.5} rx={1} fill="#f4f1ea" />}
      </g>
    </g>
  </g>;
}

/** 사무용 의자: 바퀴 받침, 좌판, 등받이. 앉은 사람보다 먼저 그린다. */
export function Chair({ at, color = "#1b2230" }: { at: Point3; color?: string }) {
  const [x, y] = project(at);
  return <g transform={`translate(${x},${y})`}>
    <ellipse cx={0} cy={0} rx={6} ry={2.5} fill="#05070b" />
    <rect x={-1} y={-9} width={2} height={9} fill="#3a4250" />
    <rect x={-7} y={-12} width={14} height={4} rx={2} fill={color} />
  </g>;
}
