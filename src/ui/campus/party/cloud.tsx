/**
 * 클라우드 운영실 파티: "루프톱 풍선 파티".
 * 하늘이 보이는 유리 방 옥상 파티. 로드 밸런서에 묶은 가용 영역(AZ)·리전 풍선 다발,
 * 유리벽 위 전구 줄, 바비큐 그릴과 음료 테이블, 창밖에 떠오른 열기구.
 */
import { points, project, type Point3 } from "../iso";
import { Cylinder } from "../parts";
import { Person } from "../art/people";
import { useParty } from "./context";
import { Balloon, Confetti, PartyTable, StringLights } from "./parts";

const SKY = "#5cc8ff";
const LB_TOP: Point3 = [5.0, 2.9, 1.55];
const BALLOONS: { at: Point3; color: string; label: string }[] = [
  { at: [4.3, 2.4, 3.3], color: "#ff5fa2", label: "AZ-a" },
  { at: [5.0, 2.2, 3.75], color: "#ffd447", label: "AZ-b" },
  { at: [5.7, 2.5, 3.35], color: "#7dff9b", label: "AZ-c" },
  { at: [4.7, 3.3, 3.0], color: "#b48bff", label: "ap-2" },
  { at: [5.5, 3.4, 2.95], color: "#ff8a3d", label: "us-1" },
];

/** 로드 밸런서 원반에 묶은 풍선 다발. 인스턴스보다 높아서 그 다음에 그린다. */
export function CloudPartyBalloons() {
  if (!useParty()) return null;
  const [lx, ly] = project(LB_TOP);
  return <g>
    {BALLOONS.map(({ at }) => {
      const [bx, by] = project(at);
      return <line key={at.join()} x1={lx} y1={ly} x2={bx} y2={by + 8} stroke="#d9d4c4" strokeWidth={0.5} opacity={0.8} />;
    })}
    {BALLOONS.map((b, i) => <Balloon key={b.label} at={b.at} color={b.color} label={b.label} delay={-i * 0.7} />)}
  </g>;
}

/** 오른쪽 빈 바닥: 음료 테이블과 바비큐 그릴, 굽는 사람. 인스턴스(앞)보다 먼저 그린다. */
export function CloudPartyDeck() {
  if (!useParty()) return null;
  const [gx, gy] = project([8.9, 4.7, 0.95]);
  return <g>
    <PartyTable at={[6.6, 3.5, 0]} size={[1.4, 0.8]} cloth={["#e6f7ff", "#8fd3f4", "#5aa9d1"]} />
    {[[6.95, 3.8], [7.3, 4.0], [7.65, 3.75]].map(([cx, cy], i) =>
      <Cylinder key={cx} at={[cx, cy, 0.72]} r={0.08} h={0.22} tone={[["#ff8a3d", "#7dff9b", "#ffd447"][i], "#d9e6ef", "#b8c7d3"]} />)}
    <Person at={[8.3, 4.0, 0]} facing="left" shirt="#ffffff" apron="#ff8a3d" pants="#14213d" hair="#2a1d18" hat={{ kind: "party", color: "#ffd447" }} />
    {/* 둥근 그릴: 다리 셋, 숯불, 연기 */}
    {[[-4, 0], [4, 0], [0, 3]].map(([dx, dy]) =>
      <line key={`${dx}${dy}`} x1={gx + dx * 0.6} y1={gy} x2={gx + dx} y2={gy + 18 + dy} stroke="#2b3542" strokeWidth={1.2} />)}
    <path d={`M${gx - 9},${gy} a9,6 0 0 0 18,0z`} fill="#1d2433" />
    <ellipse cx={gx} cy={gy} rx={9} ry={3.5} fill="#ff7a1a" opacity={0.85} />
    <ellipse className="iso-lamp" cx={gx} cy={gy} rx={6} ry={2} fill="#ffd447" />
    <path className="iso-steam" d={`M${gx - 3},${gy - 4} q-2,-4 0,-8 M${gx + 3},${gy - 5} q-2,-4 0,-8`} stroke="#d8e2ea" strokeWidth={1.2} fill="none" />
  </g>;
}

/** 열기구: 줄무늬 풍선과 바구니. 창밖 구름 사이에 떠서 천천히 오르내린다. */
function HotAirBalloon({ at }: { at: Point3 }) {
  const [x, y] = project(at);
  const stripes = ["#ff5fa2", "#ffffff", SKY, "#ffd447", "#ffffff", "#ff5fa2"];
  return <g transform={`translate(${x},${y})`}>
    <g className="iso-balloon" style={{ animationDuration: "7s" }}>
      <path d="M-15,-6 C-15,-26 15,-26 15,-6 C15,4 5,10 3,14 H-3 C-5,10 -15,4 -15,-6 Z" fill={SKY} />
      {stripes.map((color, i) => <path key={i} d={`M${-12.5 + i * 5},-${20 - Math.abs(i - 2.5) * 2} Q${-15 + i * 6},-4 ${-2.5 + i},12`}
        stroke={color} strokeWidth={2.6} fill="none" opacity={0.85} />)}
      <path d="M-3,14 L-4,20 M3,14 L4,20" stroke="#7a5034" strokeWidth={0.7} />
      <rect x={-5} y={20} width={10} height={6} rx={1} fill="#a77b4f" />
      <path className="iso-flame" d="M-1.4,15 q1.4,-4 2.8,0z" fill="#ffd447" />
    </g>
  </g>;
}

/** 유리벽 위 전구 줄, 열기구, 꽃가루. 방 그림 맨 마지막에 그린다. */
export function CloudPartySky() {
  if (!useParty()) return null;
  const lights = ["#ffd447", "#ffffff", "#ff8a3d", SKY];
  return <g>
    {/* 오른쪽 벽은 이름 간판(0.45~5.4)을 피해 뒤쪽 절반에만 건다. */}
    <StringLights from={[0.05, 9.8, 4.1]} to={[0.05, 0.1, 4.1]} colors={lights} count={18} sag={0.3} />
    <StringLights from={[5.8, 0.05, 4.1]} to={[9.8, 0.05, 4.1]} colors={lights} count={8} sag={0.25} />
    <polyline points={points([0.05, 0.1, 4.1], [0.05, 0.1, 4.2])} stroke="#1c2430" strokeWidth={0.8} />
    <HotAirBalloon at={[14.6, 4.2, 3.2]} />
    <Confetti area={[1.5, 1.5, 7.5, 5.0]} z={3.2} count={14} seed={11} colors={["#ff5fa2", "#ffd447", SKY, "#ffffff", "#7dff9b"]} />
  </g>;
}
