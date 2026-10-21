import { plane, points } from "../iso";
import { Box, Cylinder, Led, Neon, OnWall, Wire } from "../parts";
import { CONTAINER_TONES, GantryCrane, ShippingContainer, TEAL, Whale } from "./dockerParts";
import { GUNMETAL, Monitor, Plant } from "./fixtures";
import { Chair, Person } from "./people";

const WATER = "#06283a";
const HAZARD = "#ffc23d";

/** 운하: 부두 턱(노랑·검정 안전 줄), 한 단 낮은 물, 물결. 고래가 이 안에서 헤엄친다. */
function Canal() {
  const stripes = [];
  for (let x = 0.2; x < 9.8; x += 0.5) {
    stripes.push(<polygon key={x} points={points([x, 6.95, 0.14], [x + 0.25, 6.95, 0.14], [x + 0.25, 7.2, 0.14], [x, 7.2, 0.14])} fill={HAZARD} />);
  }
  return <g>
    <polygon points={points([0.2, 7.2, 0], [0.2, 9.8, 0], [0.2, 9.8, -0.35], [0.2, 7.2, -0.35])} fill="#0b1c22" />
    <polygon points={points([0.2, 7.2, 0], [9.8, 7.2, 0], [9.8, 7.2, -0.35], [0.2, 7.2, -0.35])} fill="#10262c" />
    <polygon points={plane(0.2, 7.2, 9.6, 2.6, -0.3)} fill={WATER} />
    {[7.7, 8.5, 9.3].map((y, i) => <polyline key={y} className="iso-flow" points={points([0.5, y, -0.29], [9.5, y, -0.29])}
      stroke={TEAL} strokeOpacity={0.35 - i * 0.06} strokeWidth={1} style={{ animationDuration: `${2.4 + i}s` }} />)}
    <Box at={[0.2, 6.95, 0]} size={[9.6, 0.25, 0.14]} tone={["#1b2b31", "#121e22", "#0e181b"]} />
    {stripes}
    {[1.3, 5.1, 8.9].map(x => <Cylinder key={x} at={[x, 7.07, 0.14]} r={0.1} h={0.28} tone={["#3f5560", "#1c2a30", "#152025"]} />)}
  </g>;
}

/** 물 앞쪽 가장자리. 한 단 낮게 그린 물이 방 바닥 앞선을 넘어 보이지 않게 덮는다. */
function CanalRim() {
  return <g>
    <polygon points={plane(0, 9.8, 10, 0.2, 0)} fill="#0c1c20" />
    <polygon points={plane(9.8, 7.2, 0.2, 2.6, 0)} fill="#0c1c20" />
    <Neon path={[[0.2, 9.8, 0.01], [9.8, 9.8, 0.01], [9.8, 7.2, 0.01]]} color={TEAL} width={0.7} />
  </g>;
}

/** 왼쪽 벽: docker ps 화면(문 4~6 뒤쪽)과 이미지 레이어 포스터(문 앞쪽), 구명 튜브. */
function LeftWall() {
  const rows = ["web   Up 3 min", "api   Up 3 min", "db    Up 9 min", "cache Exited"];
  return <g>
    <OnWall wall="left" at={[0, 3.8, 3.9]}>
      <rect width={70} height={34} rx={2} fill="#04141a" stroke={TEAL} strokeOpacity={0.8} />
      <text className="iso-screen-text" x={4} y={8} fill={TEAL}>$ docker ps</text>
      {rows.map((row, i) => <g key={row}>
        <circle className="iso-led" cx={6} cy={13.5 + i * 5} r={1.2} fill={i === 3 ? "#ff7a1a" : "#2cff8f"} style={{ animationDelay: `${-i * 0.5}s` }} />
        <text className="iso-screen-label" x={10} y={15.5 + i * 5} fill="#bdeee6">{row}</text>
      </g>)}
    </OnWall>
    <OnWall wall="left" at={[0, 9.5, 3.95]}>
      <rect width={64} height={44} rx={2} fill="#06161b" stroke={TEAL} strokeOpacity={0.5} />
      <text className="iso-board-title" x={4} y={9} fill={TEAL}>IMAGE LAYERS</text>
      {([["CMD", "#26e5c6"], ["COPY", "#5eaaff"], ["RUN", "#ffb39a"], ["FROM", "#ffe38a"]] as const).map(([label, color], i) =>
        <g key={label} transform={`translate(5,${13 + i * 7.2})`}>
          <rect width={54 - i * 3} height={5.6} rx={1} fill={color} opacity={0.85} />
          <text className="iso-screen-label" x={2} y={4.4} fill="#06161b">{label}</text>
        </g>)}
    </OnWall>
    <OnWall wall="left" at={[0, 8.9, 1.35]}>
      <circle cx={0} cy={0} r={7} fill="none" stroke="#ff8a65" strokeWidth={3.4} />
      <circle cx={0} cy={0} r={7} fill="none" stroke="#ffffff" strokeWidth={3.4} strokeDasharray="5.5 5.5" />
    </OnWall>
  </g>;
}

/** 오른쪽 벽 아래 포트 패널. 큰 컨테이너에서 나온 케이블이 8080→80으로 꽂힌다. */
function PortPanel() {
  return <g>
    <OnWall wall="right" at={[0.6, 0, 1.85]}>
      <rect width={34} height={18} rx={2} fill="#04141a" stroke={TEAL} strokeOpacity={0.7} />
      <text className="iso-screen-label" x={3} y={7} fill={TEAL}>PORTS</text>
      <text className="iso-screen-label" x={3} y={14} fill="#e6fffa">8080→80</text>
    </OnWall>
    <Wire from={[1.9, 0.05, 1.1]} to={[2.3, 3.0, 2.3]} color={TEAL} flow bend={-18} width={1.6} />
  </g>;
}

/**
 * 컨테이너 운영실(청록 물빛 항구): 가운데 큰 컨테이너, 그 앞 운하에서 컨테이너를 실은 고래가 헤엄치고,
 * 오른쪽 벽을 따라 이미지 컨테이너 더미와 갠트리 크레인, 부두에서 일하는 사람들.
 */
export function DockerArt() {
  return <g>
    <LeftWall />
    <PortPanel />
    {/* 운하는 화면에서 부두보다 늘 아래에 있어 먼저 그려도 가리는 것이 없다. 운하 턱에 앉은 사람·고래는 그 뒤에 그린다. */}
    <Canal />
    {/* 오른쪽 벽 앞 이미지 더미(레지스트리)와 그 위를 오가는 크레인. 이름 간판(0.45~5.4) 오른쪽에 둔다. */}
    <ShippingContainer at={[5.85, 0.25, 0]} size={[1.85, 1.25, 0.95]} tone={CONTAINER_TONES.gold} />
    <ShippingContainer at={[7.8, 0.25, 0]} size={[1.85, 1.25, 0.95]} tone={CONTAINER_TONES.blue} />
    <ShippingContainer at={[7.8, 0.25, 0.95]} size={[1.85, 1.25, 0.95]} tone={CONTAINER_TONES.teal} />
    <GantryCrane x0={5.6} x1={9.68} y0={0.05} y1={1.75} top={3.7} />
    <OnWall wall="right" at={[6.1, 1.92, 3.7]}>
      <rect width={42} height={10} rx={1.5} fill={TEAL} />
      <text className="iso-board-title" x={4} y={7.5} fill="#06161b">REGISTRY</text>
    </OnWall>

    {/* 가운데 큰 컨테이너: 실행 중 표시등과 이미지 이름, 끝면 문. */}
    <ShippingContainer at={[2.3, 2.5, 0]} size={[5.0, 2.3, 2.3]} tone={CONTAINER_TONES.blue} doors />
    <OnWall wall="right" at={[2.7, 4.8, 1.75]}>
      <rect width={56} height={14} rx={2} fill="#06243f" opacity={0.85} />
      <text className="iso-screen-text" x={5} y={10} fill="#e6fffa">app:latest</text>
    </OnWall>
    <Led at={[6.8, 4.81, 2.0]} color="#2cff8f" r={2} />
    <Neon path={[[2.3, 4.8, 2.3], [7.3, 4.8, 2.3], [7.3, 2.5, 2.3]]} color={TEAL} width={1} />

    {/* 끝문 옆 콘솔과 개발자 */}
    <Box at={[8.1, 2.8, 0]} size={[1.5, 0.7, 0.75]} tone={GUNMETAL} />
    <Monitor at={[8.4, 2.95, 0.75]} glow={TEAL} lines={4} />
    <Chair at={[8.9, 4.2, 0]} />
    <Person at={[8.9, 4.2, 0]} facing="away-right" pose="type" shirt="#1fb39b" hair="#121212" delay={-0.3} />

    {/* 부두: 오가는 엔지니어, 안전모 작업자, 운하 턱에 앉아 고래를 보는 사람 */}
    <Neon path={[[0.5, 6.15, 0.01], [9.5, 6.15, 0.01]]} color={TEAL} width={0.5} />
    <Person at={[1.0, 5.6, 0]} facing="right" pose="walk" walkTo={[6.6, 5.6, 0]} shirt="#5eaaff" pants="#14213d" hair="#3b2a20" prop="laptop" duration={13} delay={-3} />
    <Person at={[8.6, 5.7, 0]} facing="left" shirt="#26333d" apron="#d8ff3d" hat={{ kind: "cap", color: HAZARD }} prop="tablet" hair="#2a1d18" />
    <Plant at={[0.7, 6.3, 0]} scale={0.8} />
    {/* 발은 물 높이(-0.3), 엉덩이는 운하 턱 높이에 오도록 앉힌다. */}
    <Person at={[3.4, 7.3, -0.3]} facing="right" pose="sit" shirt="#ff8a65" pants="#1d2433" hair="#6b4a2f" prop="mug" />
    <Whale at={[1.9, 8.5, -0.3]} swimTo={[7.7, 8.5, -0.3]} water={WATER} />
    <CanalRim />
  </g>;
}
