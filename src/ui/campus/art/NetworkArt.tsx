import { plane, points } from "../iso";
import { Box, Cylinder, Led, Neon, OnWall, Wire } from "../parts";
import { Camera, GUNMETAL, Monitor, Rack } from "./fixtures";
import { Chair, Person } from "./people";
import { NetworkPartyGarland, NetworkPartyPingPong } from "../party/network";

const PURPLE = "#a259ff";
const ORANGE = "#ff7a1a";
const CABLES = ["#a259ff", "#00d4ff", "#ffd23f", "#ff2d95", "#00ff88"];
const CRATE = ["#3a3f4a", "#22262e", "#1a1d24"] as const;

/** 네트워크 랙 앞면의 패치 코드. 포트와 포트를 짧은 곡선으로 잇는다. */
function PatchCords({ x, y }: { x: number; y: number }) {
  return <g>{[0.6, 1.1, 1.6].map((z, i) => <Wire key={z} from={[x + 0.2, y, z]} to={[x + 0.9, y, z - 0.25]} color={CABLES[i + 1]} bend={6} width={1.1} />)}</g>;
}

/** 방화벽 장비 두 대. 주황 네온 줄과 붉은 LED로 "막는 장비"임을 드러낸다. */
function Firewall() {
  return <g>
    {[0, 0.55].map((z, i) => <g key={z}>
      <Box at={[6.7, 1.3, z]} size={[2.5, 1.0, 0.5]} tone={["#3a2a22", "#1c1410", "#140e0b"]} />
      <Neon path={[[6.8, 2.3, z + 0.38], [9.1, 2.3, z + 0.38]]} color={ORANGE} width={0.9} />
      {[0, 1, 2, 3, 4, 5].map(k => <Led key={k} at={[7.0 + k * 0.3, 2.3, z + 0.18]} color={k % 2 ? ORANGE : "#ff3355"} delay={-(k + i) * 0.27} r={1.1} />)}
    </g>)}
    <OnWall wall="right" at={[8.55, 2.3, 1.0]}><text className="iso-screen-text" fill={ORANGE}>FW</text></OnWall>
  </g>;
}

/**
 * 네트워크 운영실(네온 보라). 색깔별로 정리된 케이블이 벽을 타고 내려오고,
 * 랙 두 줄·코어 라우터·방화벽이 천장 트레이와 바닥 트렌치로 이어진다.
 */
export function NetworkArt() {
  return <g>
    {/* 바닥 케이블 트렌치와 랙 줄로 이어지는 바닥 배선. */}
    <polygon points={plane(0.8, 6.0, 8.4, 0.6, 0.01)} fill="#0a0814" />
    <Neon path={[[0.8, 6.3, 0.02], [9.2, 6.3, 0.02]]} color={PURPLE} width={1} flow />
    {[1.8, 3.1, 4.4].map((x, i) => <Neon key={x} path={[[x, 6.0, 0.02], [x, 4.8, 0.02]]} color={CABLES[i + 1]} width={0.7} />)}

    {/* 왼쪽 벽: 패치 패널과 색깔별 수직 케이블 다발. 문(4~6)을 피해 6~9.7에 둔다. */}
    <OnWall wall="left" at={[0, 9.7, 3.9]}>
      <rect width={80} height={34} rx={3} fill="#0b0912" stroke={PURPLE} strokeOpacity={0.6} />
      {Array.from({ length: 24 }, (_, i) => <rect key={i} x={5 + (i % 12) * 6} y={7 + Math.floor(i / 12) * 13} width={4} height={5} fill={CABLES[i % 5]} opacity={0.9} />)}
    </OnWall>
    {CABLES.map((c, i) => <Neon key={c} path={[[0.02, 9.2 - i * 0.55, 2.35], [0.02, 9.2 - i * 0.55, 0.05], [0.8, 9.2 - i * 0.55, 0.02]]} color={c} width={0.8} />)}

    {/* 오른쪽 벽: 토폴로지 보드(장식 도식). */}
    <OnWall wall="right" at={[6.4, 0, 3.75]}>
      <rect width={74} height={40} rx={3} fill="#0d0a18" stroke={PURPLE} />
      <text className="iso-board-title" x={6} y={10} fill={PURPLE}>TOPOLOGY</text>
      <path d="M37,16 L16,32 M37,16 L58,32 M16,32 L58,32" stroke={PURPLE} strokeWidth={1.2} strokeOpacity={0.8} />
      {[[37, 16], [16, 32], [58, 32]].map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r={4} fill="#0d0a18" stroke="#00d4ff" strokeWidth={1.4} />)}
    </OnWall>
    <Camera at={[0.05, 1.4, 3.3]} />

    {/* 천장 광케이블 트레이 두 줄(가로 노랑, 세로 청록). */}
    <Box at={[0.2, 2.05, 2.75]} size={[6.2, 0.45, 0.06]} tone={["#56606e", "#2a323d", "#202833"]} />
    <Neon path={[[0.2, 2.27, 2.84], [6.4, 2.27, 2.84]]} color="#ffd23f" width={1} flow />
    <Box at={[6.2, 0.2, 2.75]} size={[0.45, 5.4, 0.06]} tone={["#56606e", "#2a323d", "#202833"]} />
    <Neon path={[[6.42, 0.2, 2.84], [6.42, 5.6, 2.84]]} color="#00d4ff" width={1} flow />

    {/* 뒷줄: 네트워크 랙 두 대, 코어 라우터, 방화벽. */}
    {[1.3, 2.6].map((x, i) => <g key={x}><Rack x={x} y={1.5} accent={PURPLE} seed={i} leds={CABLES} /><PatchCords x={x} y={2.6} /></g>)}
    <Box at={[4.2, 1.4, 0]} size={[1.8, 1.3, 2.1]} tone={["#3a2f55", "#1a1426", "#120e1c"]} />
    {[0, 1, 2, 3, 4, 5].map(i => <g key={i}>
      <polyline points={points([4.35 + i * 0.27, 2.7, 0.2], [4.35 + i * 0.27, 2.7, 1.8])} stroke="#2a2140" strokeWidth={2.4} />
      <Led at={[4.35 + i * 0.27, 2.7, 1.6 - (i % 3) * 0.4]} color={CABLES[i % 5]} delay={-i * 0.3} r={1.3} />
    </g>)}
    <Neon path={[[4.2, 2.7, 2.1], [6.0, 2.7, 2.1]]} color={PURPLE} width={1} />
    <Firewall />
    <Wire from={[3.5, 2.6, 1.9]} to={[4.4, 2.7, 1.9]} color="#00d4ff" flow width={1.4} bend={-6} />
    <Wire from={[6.0, 2.2, 1.6]} to={[6.8, 2.3, 0.9]} color={ORANGE} flow width={1.4} bend={-6} />
    <NetworkPartyPingPong />
    <Person at={[8.2, 3.3, 0]} facing="away-right" shirt="#2b2f3a" pants="#14181f" hair="#c98d4b" prop="tablet" />

    {/* 앞줄: 분배 스위치 랙 세 대. */}
    {[1.3, 2.6, 3.9].map((x, i) => <g key={`d${x}`}><Rack x={x} y={3.7} accent={PURPLE} seed={i + 3} h={1.9} leds={CABLES} /><PatchCords x={x} y={4.8} /></g>)}

    {/* 장비 상자·케이블 릴 카트와 그 사이를 오가는 엔지니어. */}
    <Box at={[7.6, 4.0, 0]} size={[1.2, 1.0, 0.6]} tone={[...CRATE]} />
    <Box at={[7.7, 4.1, 0.6]} size={[1.0, 0.8, 0.5]} tone={[...CRATE]} />
    <Neon path={[[7.6, 5.0, 0.6], [8.8, 5.0, 0.6]]} color="#ffd23f" width={0.6} />
    <Cylinder at={[9.0, 5.6, 0]} r={0.45} h={0.4} tone={["#ffd23f", "#b38f12", "#8c700c"]} />
    <Person at={[4.9, 5.4, 0]} facing="right" pose="walk" walkTo={[7.2, 5.4, 0]} shirt="#a259ff" pants="#1b1b28" hair="#2a1d18" prop="laptop" duration={8} delay={-3} />

    {/* 콘솔 책상(왼쪽 앞)과 작업대(오른쪽 앞). */}
    <Box at={[1.0, 7.0, 0]} size={[2.2, 0.9, 0.78]} tone={GUNMETAL} />
    <Monitor at={[1.4, 7.15, 0.78]} glow={PURPLE} />
    <Chair at={[2.0, 8.7, 0]} />
    <Person at={[2.0, 8.7, 0]} facing="away-right" pose="type" shirt="#5b2bb5" hair="#3b2a20" delay={-0.5} />
    <Box at={[5.4, 6.9, 0]} size={[3.4, 1.0, 0.85]} tone={["#4a3d2e", "#2a2219", "#1f1912"]} />
    <Box at={[5.7, 7.1, 0.85]} size={[0.9, 0.5, 0.35]} tone={[ORANGE, "#b8520c", "#8c3e09"]} />
    <Monitor at={[7.0, 7.05, 0.85]} w={0.8} glow="#00d4ff" />
    <Person at={[6.4, 8.6, 0]} facing="away-right" shirt="#e6f1f8" pants="#3a2f55" hair="#c98d4b" prop="laptop" />
    <Cylinder at={[9.0, 8.8, 0]} r={0.6} h={0.45} tone={["#a259ff", "#5a2aa0", "#40207a"]} />
    <Cylinder at={[9.0, 8.8, 0.45]} r={0.2} h={0.06} tone={GUNMETAL} />
    <NetworkPartyGarland />
  </g>;
}
