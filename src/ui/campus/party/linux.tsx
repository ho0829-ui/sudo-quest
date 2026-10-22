/**
 * 리눅스 운영실 파티: "업타임 생일 파티".
 * 서버가 한 번도 안 꺼지고 버틴 날을 생일처럼 축하한다. 랙 위 초록 전구 줄, 터미널 커서를 꽂은 케이크,
 * 고깔모자를 쓴 펭귄 인형, `$ echo "HAPPY UPTIME"` 현수막.
 */
import { project, type Point3 } from "../iso";
import { Cylinder, OnWall } from "../parts";
import { useParty } from "./context";
import { Cake, Confetti, PartyTable, StringLights } from "./parts";

const GREEN = "#00ff66";
const LIGHTS = [GREEN, "#e8fff0", "#00d4ff", GREEN, "#b6ffd1"];

/** 왼쪽 벽 현수막. 문(4~6) 위를 피해 6~9.7 구간에 건다. */
export function LinuxPartyBanner() {
  if (!useParty()) return null;
  return <OnWall wall="left" at={[0, 9.6, 3.95]}>
    <rect width={80} height={15} rx={2} fill="#06140c" stroke={GREEN} strokeWidth={1.2} />
    <text className="iso-party-banner" x={40} y={10} textAnchor="middle" fill={GREEN}>$ echo "HAPPY UPTIME"</text>
    <rect className="iso-cursor" x={72} y={4} width={3} height={7} fill={GREEN} />
  </OnWall>;
}

/** 찬 공기 통로 지붕 양쪽 모서리를 따라 건 전구 줄. 앞줄 랙보다 높아서 랙 다음에 그린다. */
export function LinuxPartyLights() {
  if (!useParty()) return null;
  return <g>
    <StringLights from={[1.1, 3.0, 2.6]} to={[8.5, 3.0, 2.6]} colors={LIGHTS} count={16} sag={0.25} />
    <StringLights from={[1.1, 5.6, 2.6]} to={[8.5, 5.6, 2.6]} colors={LIGHTS} count={16} sag={0.25} />
  </g>;
}

/** 고깔모자를 쓴 펭귄 인형(리눅스를 떠올리게 하는 자체 그림). at은 발 위치. */
function Penguin({ at }: { at: Point3 }) {
  const [x, y] = project(at);
  return <g transform={`translate(${x},${y})`}>
    <ellipse cx={0} cy={-6} rx={5} ry={6.5} fill="#1a1f26" />
    <ellipse cx={0.8} cy={-5} rx={3.2} ry={4.8} fill="#f4f6f8" />
    <circle cx={0} cy={-13} r={3.6} fill="#1a1f26" />
    <circle cx={1.4} cy={-13.6} r={0.8} fill="#ffffff" />
    <path d="M2.6,-12.4 l3,0.8 l-3,0.9z" fill="#ffb02e" />
    <path d="M-3,0 h2.6 l-1.3,-1.4z M0.6,0 h2.6 l-1.3,-1.4z" fill="#ffb02e" />
    <path d="M-2.6,-15.8 L0,-23 L2.6,-15.8z" fill="#ff5fa2" />
    <circle cx={0} cy={-23} r={1} fill="#ffd447" />
  </g>;
}

/** 앞쪽 파티 테이블: 커서 초를 꽂은 케이크, 펭귄 인형, 종이컵. */
export function LinuxPartyTable() {
  if (!useParty()) return null;
  return <g>
    <PartyTable at={[4.0, 7.0, 0]} size={[1.7, 0.75]} cloth={["#eafff1", "#a8dcb9", "#86c39b"]} />
    <Cake at={[4.95, 7.35, 0.72]} band={GREEN} cream="#f4fff7" candle="cursor" />
    <Penguin at={[4.3, 7.45, 0.72]} />
    {[[5.5, 7.15], [5.45, 7.5]].map(([cx, cy]) =>
      <Cylinder key={cx + cy} at={[cx, cy, 0.72]} r={0.07} h={0.16} tone={["#ffffff", "#ff5fa2", "#d9417f"]} />)}
  </g>;
}

/** 방 앞쪽 위로 떨어지는 꽃가루. 방 그림 맨 마지막에 그린다. */
export function LinuxPartyConfetti() {
  if (!useParty()) return null;
  return <Confetti area={[1.5, 6.6, 7.5, 3.0]} z={3.0} count={16} seed={3} colors={[GREEN, "#ffffff", "#00d4ff", "#ffd447", "#ff5fa2"]} />;
}
