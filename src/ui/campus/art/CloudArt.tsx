import { floorTransform, plane, points, project } from "../iso";
import { Box, Cylinder, Neon, OnWall, Wire, type Tone } from "../parts";
import { WALL_HEIGHT } from "../rooms";
import { Person } from "./people";

const SKY = "#5cc8ff";
const INSTANCE: Tone = ["#e6f7ff", "#8fd3f4", "#5aa9d1"];
const INSTANCES: [number, number][] = [[1.7, 6.5], [3.1, 6.5], [5.9, 6.5], [7.3, 6.5]];

/** 떠다니는 구름. CSS 애니메이션의 transform이 위치를 덮지 않게 바깥·안쪽 g를 나눈다. */
function Cloud({ at, scale, delay }: { at: [number, number, number]; scale: number; delay: number }) {
  const [x, y] = project(at);
  return <g transform={`translate(${x},${y}) scale(${scale})`}>
    <g className="iso-cloud" style={{ animationDelay: `${delay}s` }}>
      <ellipse cx={0} cy={0} rx={26} ry={11} fill="#e8f7ff" />
      <circle cx={-10} cy={-7} r={11} fill="#f4fbff" />
      <circle cx={9} cy={-10} r={14} fill="#f4fbff" />
      <ellipse cx={0} cy={4} rx={24} ry={5} fill="#bfe6fa" />
    </g>
  </g>;
}

/**
 * AWS 클라우드룸(하늘색 유리 방). 가용 영역(AZ) 두 곳에 인스턴스가 나뉘어 있고,
 * 로드 밸런서가 요청을 나눠 준다. 보안 그룹(주황 점선)이 인스턴스를 감싼다.
 */
export function CloudArt() {
  return <g>
    {/* 유리벽 창살. */}
    {[2, 4, 6, 8].map(v => <g key={v}>
      <polyline points={points([v, 0, 0], [v, 0, WALL_HEIGHT])} stroke={SKY} strokeOpacity={0.3} />
      <polyline points={points([0, v, 0], [0, v, WALL_HEIGHT])} stroke={SKY} strokeOpacity={0.3} />
    </g>)}
    {/* 리전 플랫폼과 가용 영역 두 곳. */}
    <polygon points={plane(0.7, 0.7, 8.6, 8.6, 0.02)} fill="#5cc8ff0d" stroke={SKY} strokeDasharray="6 5" strokeOpacity={0.6} />
    {([[1.2, "AZ-a"], [5.4, "AZ-b"]] as const).map(([x, label]) => <g key={label}>
      <polygon points={plane(x, 5.7, 3.4, 2.9, 0.03)} fill="#5cc8ff12" stroke={SKY} strokeOpacity={0.8} />
      <g transform={floorTransform([x + 0.2, 8.45, 0.04])}><text className="iso-floor-mark" fill={SKY}>{label}</text></g>
    </g>)}
    <polygon points={plane(1.4, 6.1, 7.2, 1.7, 0.05)} fill="none" stroke="#ff7a1a" strokeDasharray="4 4" strokeWidth={1.3} />

    {/* 홀로그램 콘솔과 클라우드 엔지니어. */}
    <Box at={[1.6, 2.0, 0]} size={[1.2, 0.7, 0.95]} tone={["#9fdcf7", "#3f87ad", "#2f6c8d"]} />
    <OnWall wall="right" at={[1.5, 2.6, 2.35]}>
      <rect className="iso-holo" width={34} height={22} rx={2} fill={SKY} opacity={0.25} stroke={SKY} />
      {[5, 10, 15].map(y => <rect key={y} x={4} y={y} width={18 + y} height={2} fill="#e6f7ff" opacity={0.8} />)}
    </OnWall>
    <Person at={[2.3, 3.6, 0]} facing="away-right" shirt="#ff9a3d" pants="#1d2433" hair="#2a1d18" />

    {/* 객체 저장소 버킷. */}
    <Cylinder at={[8.4, 2.0, 0]} r={0.6} h={0.9} tone={["#d8f3ff", SKY, "#3fa9de"]} />
    <Neon path={[[7.85, 2.0, 0.9], [8.95, 2.0, 0.9]]} color="#ffffff" width={0.6} />

    {/* 로드 밸런서: 받침대 위 원반에서 인스턴스 네 대로 요청을 나눈다. */}
    <Box at={[4.7, 2.6, 0]} size={[0.6, 0.6, 1.3]} tone={["#9fdcf7", "#4d9cc4", "#3a7ea3"]} />
    <Cylinder at={[5.0, 2.9, 1.3]} r={0.95} h={0.25} tone={["#c9f0ff", SKY, "#3fb3e6"]} />
    {INSTANCES.map(([x, y]) => <Wire key={x} from={[5.0, 2.9, 1.55]} to={[x + 0.48, y + 0.48, 0.95]} color={SKY} flow bend={-10} width={1.5} />)}
    {/* 로드 밸런서와 인스턴스 사이를 오가는 엔지니어. 인스턴스보다 뒤라서 먼저 그린다. */}
    <Person at={[1.4, 5.0, 0]} facing="right" pose="walk" walkTo={[6.2, 5.0, 0]} shirt="#5cc8ff" pants="#14213d" hair="#3b2a20" prop="tablet" duration={11} delay={-6} />
    {INSTANCES.map(([x, y], i) => <g key={`i${x}`}>
      <Box at={[x, y, 0]} size={[0.95, 0.95, 0.95]} tone={INSTANCE} />
      <Neon path={[[x, y + 0.95, 0.95], [x + 0.95, y + 0.95, 0.95]]} color={SKY} width={0.7} />
      <OnWall wall="right" at={[x + 0.15, y + 0.95, 0.6]}><text className="iso-screen-text" fill="#1a5f85">i-0{i + 1}</text></OnWall>
    </g>)}

    {/* 왼쪽 벽 문(4~6) 옆 IAM 출입 게이트: 열쇠 표시 단말과 차단봉. */}
    <OnWall wall="left" at={[0, 7.1, 2.4]}>
      <rect width={22} height={30} rx={3} fill="#0a1a26" stroke={SKY} />
      <circle cx={11} cy={10} r={4} fill="none" stroke="#ff7a1a" strokeWidth={1.6} />
      <rect x={10} y={13} width={2} height={9} fill="#ff7a1a" />
    </OnWall>
    <Box at={[0.4, 3.6, 0]} size={[0.3, 0.3, 0.95]} tone={["#c9f0ff", "#4d9cc4", "#3a7ea3"]} />
    <Box at={[0.4, 6.1, 0]} size={[0.3, 0.3, 0.95]} tone={["#c9f0ff", "#4d9cc4", "#3a7ea3"]} />
    <Neon path={[[0.55, 3.75, 0.95], [0.55, 6.25, 0.95]]} color="#ff7a1a" width={0.8} />

    <Person at={[8.6, 9.0, 0]} facing="left" shirt="#e6f7ff" pants="#3a7ea3" hair="#5a3a22" prop="laptop" />
    {/* 이름 간판(오른쪽 벽 앞쪽)과 옆 관제실을 가리지 않게 방 오른쪽 위에 띄운다. */}
    <Cloud at={[9.6, 1.2, WALL_HEIGHT + 1.6]} scale={0.85} delay={0} />
    <Cloud at={[7.6, 0.4, WALL_HEIGHT + 3.0]} scale={0.6} delay={-5.5} />
    <Cloud at={[9.8, 6.0, WALL_HEIGHT + 0.8]} scale={0.7} delay={-3} />
  </g>;
}
