/**
 * 관제실 피날레: "전사 시상식"(모든 운영실의 장애를 해결했을 때).
 * 뒷벽 앞 시상대와 트로피, 시상대를 훑는 스포트라이트, 책상 줄 사이에 매단 `ALL SECTORS CLEAR` 현수막.
 * 커뮤니티 카페에는 축하 케이크가 배달된다(CommunityPartyCake).
 * 방 앞쪽은 앞 방들의 벽에 가려지므로 모두 뒷벽~가운데에 둔다.
 */
import type { CSSProperties } from "react";
import { points, project, type Point3 } from "../iso";
import { Box, Cylinder, OnWall, type Tone } from "../parts";
import { Person } from "../art/people";
import { useParty } from "./context";
import { Cake, Confetti, Garland } from "./parts";

const GOLD: Tone = ["#ffe38a", "#d9a92e", "#ad8422"];
const STEPS = [
  { x: 3.0, h: 0.45, rank: "2", shirt: "#dfe9ff" },
  { x: 3.8, h: 0.7, rank: "1", shirt: "#ffd447" },
  { x: 4.6, h: 0.3, rank: "3", shirt: "#ff8a3d" },
];
const Y = 0.6;

/** 시상대·수상자 세 명·트로피·스포트라이트. 첫 책상 줄보다 먼저(뒤에) 그린다. */
export function ControlPartyStage() {
  if (!useParty()) return null;
  return <g>
    <SpotLight from={[1.2, 3.6, 4.2]} to={[4.2, 1.0, 0.7]} delay={0} />
    <SpotLight from={[7.4, 3.0, 4.2]} to={[4.2, 1.0, 0.7]} delay={-2} />
    {STEPS.map(step => <g key={step.rank}>
      <Box at={[step.x, Y, 0]} size={[0.8, 0.8, step.h]} tone={["#f4f6fb", "#c9d1dc", "#aab4c2"]} />
      <OnWall wall="right" at={[step.x + 0.3, Y + 0.8, step.h - 0.12]}>
        <text className="iso-party-sign" x={0} y={0} fill="#2f7bff">{step.rank}</text>
      </OnWall>
      <Person at={[step.x + 0.4, Y + 0.4, step.h]} facing="right" shirt={step.shirt} tie="#2f7bff" pants="#14213d" hair="#2a1d18" />
    </g>)}
    {/* 시상대 왼쪽 받침 위 큰 트로피 */}
    <Box at={[2.1, Y + 0.1, 0]} size={[0.6, 0.6, 0.6]} tone={["#202a3a", "#121925", "#0d131c"]} />
    <Trophy at={[2.4, Y + 0.4, 0.6]} />
  </g>;
}

function Trophy({ at }: { at: Point3 }) {
  const [x, y] = project([at[0], at[1], at[2] + 0.2]);
  return <g>
    <Cylinder at={at} r={0.22} h={0.2} tone={["#3a2a1c", "#2a1d14", "#20160f"]} />
    <rect x={x - 1.4} y={y - 8} width={2.8} height={8} fill={GOLD[1]} />
    <path d={`M${x - 8},${y - 22} h16 q0,13 -8,14 q-8,-1 -8,-14z`} fill={GOLD[0]} stroke={GOLD[2]} strokeWidth={0.8} />
    <path d={`M${x - 8},${y - 19} q-5,0 -4,4 q1,3 5,3 M${x + 8},${y - 19} q5,0 4,4 q-1,3 -5,3`} stroke={GOLD[1]} strokeWidth={1.4} fill="none" />
    <path className="iso-sparkle" d={`M${x + 4},${y - 26} l1,2 l2,1 l-2,1 l-1,2 l-1,-2 l-2,-1 l2,-1z`} fill="#ffffff" />
  </g>;
}

/** 천장 모서리에서 시상대로 내리꽂는 빛기둥. 좌우로 천천히 흔들린다. */
function SpotLight({ from, to, delay }: { from: Point3; to: Point3; delay: number }) {
  const [ax, ay] = project(from);
  const [bx, by] = project(to);
  return <g className="iso-spot" style={{ animationDelay: `${delay}s` } as CSSProperties}>
    <polygon points={`${ax},${ay} ${bx - 26},${by} ${bx + 26},${by}`} fill="#fff4c2" opacity={0.12} />
    <ellipse cx={bx} cy={by} rx={26} ry={9} fill="#fff4c2" opacity={0.14} />
  </g>;
}

/** 두 책상 줄 사이에 매단 현수막. 첫 줄 다음, 둘째 줄보다 먼저 그린다. */
export function ControlPartyBanner() {
  if (!useParty()) return null;
  return <g>
    <polyline points={points([1.0, 4.5, 4.2], [1.0, 4.5, 3.6])} stroke="#6b7280" strokeWidth={0.6} />
    <polyline points={points([5.3, 4.5, 4.2], [5.3, 4.5, 3.6])} stroke="#6b7280" strokeWidth={0.6} />
    {/* 시상대(오른쪽 뒤)를 가리지 않게 왼쪽으로 치우쳐 건다. */}
    <OnWall wall="right" at={[0.6, 4.5, 3.65]}>
      <rect width={112} height={16} rx={2} fill="#0b1b3a" stroke="#ffd447" strokeWidth={1.2} />
      <text className="iso-party-sign iso-sparkle" x={56} y={11.5} textAnchor="middle" fill="#ffd447">ALL SECTORS CLEAR</text>
    </OnWall>
  </g>;
}

export function ControlPartyConfetti() {
  if (!useParty()) return null;
  return <Confetti area={[1.0, 0.8, 8.0, 6.0]} z={3.6} count={22} seed={19} />;
}

/** 커뮤니티 카페: 모든 운영실이 끝나면 첫 번째 테이블에 축하 케이크가 배달된다. */
export function CommunityPartyCake() {
  if (!useParty()) return null;
  return <g>
    <Cake at={[4.15, 4.05, 0.8]} band="#ff9a6b" />
    <Garland from={[6.2, 0.05, 4.12]} to={[9.8, 0.05, 4.12]} count={8} sag={0.12} colors={["#ff9a6b", "#ffd08a", "#7fc8a9", "#f4f1ea"]} />
  </g>;
}
