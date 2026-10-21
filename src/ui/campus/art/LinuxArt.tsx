import { floorTransform, plane, points } from "../iso";
import { Box, Neon, OnWall } from "../parts";
import { Camera, CoolingUnit, Extinguisher, GasCylinders, GUNMETAL, Monitor, Rack } from "./fixtures";
import { Chair, Person } from "./people";

const GREEN = "#00ff66";
const LEDS = ["#00ff66", "#00ff66", "#00d4ff", "#b6ffd1"];
const COLUMNS = [1.2, 2.4, 3.6, 4.8, 6.0, 7.2];

/**
 * 리눅스 서버실(전기 초록, 터미널 감성).
 * 랙 두 줄이 찬 공기 통로(cold aisle)를 마주 보고, 통로는 지붕과 유리문으로 가둔다(컨테인먼트).
 * 앞줄 랙은 뒷면이 보이고 그 위로 뜨거운 공기가 빠져나간다.
 */
export function LinuxArt() {
  return <g>
    {/* 찬 공기 통로 바닥: 타공 타일과 바닥 글씨. */}
    <polygon points={plane(1.2, 3.0, 7.2, 2.6, 0.01)} fill="#0c2a18" />
    {COLUMNS.map(x => <polygon key={x} points={plane(x + 0.15, 3.35, 0.85, 1.9, 0.015)} fill="url(#perforated)" />)}
    <g transform={floorTransform([2.0, 4.55, 0.02])}><text className="iso-floor-mark" fill={GREEN}>COLD AISLE</text></g>

    {/* 뒤쪽 뜨거운 통로: 소화 가스 실린더, 분전반. */}
    <GasCylinders x={9.3} y={0.6} />
    <OnWall wall="right" at={[6.3, 0, 3.35]}>
      <rect width={30} height={24} rx={2} fill="#1a222c" stroke="#3a4554" />
      <rect x={4} y={5} width={22} height={3} fill={GREEN} opacity={0.5} />
      <rect x={4} y={11} width={10} height={9} fill="#0b1016" />
      <path d="M8,0 v-14 M20,0 v-14" stroke="#3a4554" strokeWidth={2} />
    </OnWall>
    <Camera at={[0.05, 1.4, 3.3]} />

    {/* 뒷줄 랙(앞면이 통로 쪽) + 천장 케이블 사다리. */}
    {COLUMNS.map((x, i) => <Rack key={`a${x}`} x={x} y={1.9} accent={GREEN} seed={i} leds={LEDS} />)}
    <Box at={[1.1, 2.15, 2.75]} size={[7.4, 0.55, 0.06]} tone={["#56606e", "#2a323d", "#202833"]} />
    <Neon path={[[1.1, 2.3, 2.83], [8.5, 2.3, 2.83]]} color="#ffd23f" width={0.9} flow />
    <Neon path={[[1.1, 2.55, 2.83], [8.5, 2.55, 2.83]]} color={GREEN} width={0.9} />
    {COLUMNS.map(x => <polyline key={`c${x}`} points={points([x + 0.5, 2.4, 2.75], [x + 0.5, 2.4, 2.3])} stroke="#ffd23f" strokeWidth={1.2} />)}

    {/* 통로 컨테인먼트: 반투명 지붕과 끝단 유리문. */}
    <polygon points={plane(1.2, 3.0, 7.2, 2.6, 2.32)} fill={GREEN} opacity={0.06} />
    <Neon path={[[1.2, 3.0, 2.32], [8.4, 3.0, 2.32], [8.4, 5.6, 2.32]]} color={GREEN} width={0.8} />
    <polygon points={points([8.4, 3.0, 0], [8.4, 5.6, 0], [8.4, 5.6, 2.32], [8.4, 3.0, 2.32])} fill="#00ff6612" stroke={GREEN} strokeOpacity={0.7} />
    <polyline points={points([8.4, 4.3, 0], [8.4, 4.3, 2.32])} stroke={GREEN} strokeOpacity={0.5} />

    {/* 항온항습기: 왼쪽 벽 앞, 찬 공기를 바닥 아래로 보낸다. */}
    <CoolingUnit x={0.05} y={6.9} accent="#00d4ff" />

    {/* 앞줄 랙(뒷면 배선이 보임)과 위로 빠지는 열기. */}
    {COLUMNS.map((x, i) => <Rack key={`b${x}`} x={x} y={5.6} accent={GREEN} seed={i + 2} rear />)}
    {[2.0, 4.4, 6.8].map(x => <polyline key={`h${x}`} className="iso-flow iso-heat" points={points([x, 6.9, 2.4], [x + 0.2, 6.9, 3.0], [x, 6.9, 3.6])} stroke="#ff7a1a" strokeWidth={1.1} fill="none" />)}

    {/* 통로 끝을 오가는 점검자. 앞쪽 책상보다 뒤에 있으므로 먼저 그린다. */}
    <Person at={[9.3, 3.2, 0]} facing="left" pose="walk" walkTo={[9.3, 6.8, 0]} shirt="#14301f" pants="#0b120e" hair="#c98d4b" prop="laptop" duration={9} delay={-5} />

    {/* 운영 책상과 근무자. */}
    <Box at={[6.6, 7.7, 0]} size={[2.6, 0.9, 0.78]} tone={GUNMETAL} />
    <Monitor at={[6.9, 7.85, 0.78]} glow={GREEN} />
    <Monitor at={[7.95, 7.85, 0.78]} glow="#00d4ff" />
    <Person at={[3.0, 7.25, 0]} facing="away-right" shirt="#1f6f4a" prop="tablet" />
    <Person at={[2.4, 8.7, 0]} facing="right" pose="walk" walkTo={[5.6, 8.7, 0]} shirt="#e6f1f8" pants="#2b3542" hair="#6b4a2f" delay={-2} />
    <Chair at={[7.7, 9.35, 0]} />
    <Person at={[7.7, 9.35, 0]} facing="away-right" pose="type" shirt="#00a35a" hair="#121212" skin="#c99a73" />
    <Extinguisher at={[9.5, 9.4, 0]} />
  </g>;
}
