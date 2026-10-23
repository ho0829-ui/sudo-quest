/**
 * 웹·DB 운영실 파티: "쿼리 칵테일 바".
 * 트랜잭션이 끝까지 지켜져(ACID) 축배를 든다. 랙 앞 빈 바닥에 바 카운터와 바텐더,
 * 왼쪽 벽 네온 `ACID BAR`와 메뉴판(COMMIT · ROLLBACK · INNER JOIN), 천장의 미러볼.
 */
import { points, project, type Point3 } from "../iso";
import { Box, Cylinder, Neon, OnWall } from "../parts";
import { Person } from "../art/people";
import { WALL_HEIGHT } from "../rooms";
import { useParty } from "./context";
import { Confetti } from "./parts";

const MAGENTA = "#ff2d95";
const MENU = ["COMMIT", "ROLLBACK", "INNER JOIN"];
// 방 앞쪽(오른쪽 아래)은 앞 방 벽에 가려지므로, 랙 앞 빈 바닥(가운데 왼쪽)에 바를 차린다.
const BAR = { x: 1.2, y: 4.0, w: 2.8, d: 0.6, h: 0.95 };

/** 왼쪽 벽: 네온 간판과 메뉴판. 문(4~6) 뒤쪽 벽을 쓴다. */
export function WebDbPartyWall() {
  if (!useParty()) return null;
  return <g>
    <OnWall wall="left" at={[0, 3.85, 3.85]}>
      <rect width={52} height={14} rx={3} fill="#12070e" stroke={MAGENTA} strokeOpacity={0.6} />
      <text className="iso-party-sign iso-sparkle" x={26} y={10.5} textAnchor="middle" fill={MAGENTA}>ACID BAR</text>
    </OnWall>
    <OnWall wall="left" at={[0, 3.6, 3.05]}>
      <rect width={44} height={24} rx={2} fill="#1b1016" stroke="#d9a441" strokeWidth={1.2} />
      {MENU.map((item, i) => <g key={item}>
        <text className="iso-chalk" x={4} y={7.5 + i * 6.5}>{item}</text>
        <text className="iso-chalk" x={40} y={7.5 + i * 6.5} textAnchor="end">{["$0", "$0", "$1"][i]}</text>
      </g>)}
    </OnWall>
  </g>;
}

function Bottle({ at, color }: { at: Point3; color: string }) {
  return <g>
    <Cylinder at={at} r={0.07} h={0.24} tone={[color, color, color]} />
    <Cylinder at={[at[0], at[1], at[2] + 0.24]} r={0.03} h={0.1} tone={["#e6f1f8", "#b8c4cc", "#9aa6ae"]} />
  </g>;
}

/** 바텐더·바 카운터·손님 두 명. 랙 다음, 책상 앞에 그린다. */
export function WebDbPartyBar() {
  if (!useParty()) return null;
  const { x, y, w, d, h } = BAR;
  return <g>
    <Person at={[x + 1.4, y - 0.5, 0]} facing="right" shirt="#f4f1ea" apron="#1a1016" tie={MAGENTA} hair="#121212" prop="glass" />
    <Box at={[x, y, 0]} size={[w, d, h]} tone={["#3a1a2c", "#1f0d18", "#160912"]} />
    <Box at={[x - 0.05, y - 0.05, h]} size={[w + 0.1, d + 0.1, 0.07]} tone={["#d9a441", "#a8792a", "#8a6220"]} />
    <Neon path={[[x, y + d, 0.12], [x + w, y + d, 0.12]]} color={MAGENTA} width={0.9} />
    {[["#7dff9b", 0.4], ["#ffd447", 0.75], ["#5cc8ff", 2.2], ["#ff8a3d", 2.5]].map(([color, dx]) =>
      <Bottle key={dx} at={[x + Number(dx), y + 0.25, h + 0.07]} color={String(color)} />)}
    {/* 칵테일 잔 두 개: 받침 위 역삼각형 잔 */}
    {[1.4, 1.75].map(dx => {
      const [gx, gy] = project([x + dx, y + 0.35, h + 0.07]);
      return <g key={dx}>
        <path d={`M${gx - 3},${gy - 7} h6 l-3,4z`} fill={dx > 1.5 ? "#ff8cc6" : "#7ff2df"} opacity={0.9} />
        <rect x={gx - 0.4} y={gy - 3} width={0.8} height={3} fill="#e6f1f8" />
      </g>;
    })}
    <Person at={[x + 0.6, y + 1.3, 0]} facing="away-right" shirt="#ffd23f" pants="#1d1d28" hair="#7a3b1d" prop="glass" />
    <Person at={[x + 2.2, y + 1.35, 0]} facing="away-left" shirt="#3a1a2c" pants="#14181f" hair="#c98d4b" skin="#e0b48a" prop="glass" />
  </g>;
}

/** 바 위 천장에 매단 미러볼과 바닥에 흩어지는 반사광. 방 그림 맨 마지막에 그린다. */
export function WebDbPartyMirrorBall() {
  if (!useParty()) return null;
  const at: Point3 = [BAR.x + 1.4, BAR.y + 0.3, 3.3];
  const [bx, by] = project(at);
  const spots: Point3[] = [[1.0, 3.2, 0.02], [4.3, 3.0, 0.02], [4.8, 5.4, 0.02], [0.9, 5.7, 0.02], [3.4, 6.0, 0.02], [5.4, 4.3, 0.02]];
  return <g>
    <polyline points={points([at[0], at[1], WALL_HEIGHT], [at[0], at[1], at[2] + 0.3])} stroke="#9aa6ae" strokeWidth={0.6} />
    {spots.map(([sx, sy, sz], i) => <ellipse key={i} className="iso-sparkle" cx={project([sx, sy, sz])[0]} cy={project([sx, sy, sz])[1]}
      rx={3} ry={1.5} fill={i % 2 ? "#ffffff" : "#ff8cc6"} opacity={0.7} style={{ animationDelay: `${-i * 0.3}s` }} />)}
    <circle cx={bx} cy={by} r={7} fill="#c9d1dc" />
    <g className="iso-mirror">
      {[-4, 0, 4].map(dy => <line key={dy} x1={bx - 6.5} y1={by + dy} x2={bx + 6.5} y2={by + dy} stroke="#7a8796" strokeWidth={0.6} />)}
      {[-4, 0, 4].map(dx => <line key={dx} x1={bx + dx} y1={by - 6.5} x2={bx + dx} y2={by + 6.5} stroke="#7a8796" strokeWidth={0.6} />)}
    </g>
    <circle className="iso-sparkle" cx={bx - 2.5} cy={by - 2.5} r={1.6} fill="#ffffff" />
    <Confetti area={[0.8, 2.6, 5.0, 4.0]} z={3.0} count={12} seed={7} colors={[MAGENTA, "#ffd447", "#5cc8ff", "#ffffff"]} />
  </g>;
}
