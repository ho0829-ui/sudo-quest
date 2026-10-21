import { Box, Neon, OnWall, type Tone } from "../parts";
import { GUNMETAL, Monitor } from "./fixtures";
import { Chair, Person } from "./people";
import { miniMapLayout } from "../layout";

export interface WallStat { label: string; cleared: number; total: number }
export interface MapRoom { accent: string; alarm: boolean | null }

const BLUE = "#2f7bff";
const PLATINUM = "#dfe9ff";
const DESK: Tone = ["#202a3a", "#121925", "#0d131c"];

/** 분류별 화면: 이름·해결 수·진행 막대. 실제 학습 기록 값이다(가짜 지표가 아님). */
function StatScreen({ x, y, stat }: { x: number; y: number; stat: WallStat }) {
  const ratio = stat.total ? stat.cleared / stat.total : 0;
  const done = stat.total > 0 && stat.cleared === stat.total;
  return <g transform={`translate(${x},${y})`}>
    {/* 가장 긴 "NETWORK"가 들어가는 폭. 두 칸(40+2+40)이 문(4~6) 오른쪽 벽 끝까지 들어간다. */}
    <rect width={40} height={22} rx={2} fill="#050a14" stroke={BLUE} strokeOpacity={0.7} />
    <text className="iso-screen-label" x={2.5} y={8}>{stat.label}</text>
    <text className="iso-screen-value" x={3} y={16} fill={done ? "#2cff8f" : PLATINUM}>{stat.cleared}/{stat.total}</text>
    <rect x={3} y={18.5} width={34} height={1.6} fill="#16233d" />
    <rect x={3} y={18.5} width={34 * ratio} height={1.6} fill={done ? "#2cff8f" : "#00d4ff"} />
  </g>;
}

const MAP = miniMapLayout();
// 벽에 걸 수 있는 크기. 방이 늘어 화면이 커지면 이 안에 들어가게 줄인다.
const MAP_FIT = Math.min(1, 62 / MAP.width, 50 / MAP.height);

/** 캠퍼스 미니맵: 방마다 마름모 하나, 경보등 상태를 점으로. 실제 진행 상태를 그대로 보여 준다. rooms는 ROOMS 순서다. */
function MiniMap({ rooms }: { rooms: MapRoom[] }) {
  const { cells, width, height } = MAP;
  return <g transform={`scale(${MAP_FIT})`}>
    <rect width={width} height={height} rx={3} fill="#050a14" stroke={PLATINUM} strokeOpacity={0.5} />
    <text className="iso-screen-label" x={4} y={8}>CAMPUS MAP</text>
    {rooms.map((room, i) => {
      const [cx, cy] = cells[i];
      return <g key={i}>
        <path d={`M${cx},${cy - 5} l9,5 l-9,5 l-9,-5z`} fill="none" stroke={room.accent} strokeWidth={1.2} />
        {room.alarm !== null && <circle cx={cx} cy={cy} r={1.8} fill={room.alarm ? "#ff7a1a" : "#2cff8f"} className={room.alarm ? "iso-led" : undefined} />}
      </g>;
    })}
  </g>;
}

/** 운영자 책상 한 줄: 책상, 모니터 세 대, 책상 앞 플래티넘 네온, 의자에 앉아 타이핑하는 사람. */
function DeskRow({ y, people }: { y: number; people: { shirt: string; hair: string; skin?: string }[] }) {
  const seats = [2.6, 4.4, 6.2];
  return <g>
    <Box at={[2.0, y, 0]} size={[5.8, 1.1, 0.8]} tone={DESK} />
    <Neon path={[[2.0, y + 1.1, 0.8], [7.8, y + 1.1, 0.8]]} color={PLATINUM} width={0.8} />
    {seats.map((x, i) => <Monitor key={x} at={[x, y + 0.2, 0.8]} w={1.2} glow={i === 1 ? "#00d4ff" : BLUE} />)}
    {seats.map((x, i) => people[i] && <g key={`p${x}`}>
      <Chair at={[x + 0.6, y + 1.9, 0]} color="#1a2438" />
      <Person at={[x + 0.6, y + 1.9, 0]} facing="away-right" pose="type" shirt={people[i].shirt} hair={people[i].hair} skin={people[i].skin} delay={-i * 0.3} />
    </g>)}
  </g>;
}

/** 관제실(전기 파랑 + 플래티넘 화이트): 비디오 월, 시계, 미니맵, 운영자 두 줄, 감독자. */
export function ControlArt({ stats, total, clock, rooms }: { stats: WallStat[]; total: WallStat; clock: string; rooms: MapRoom[] }) {
  return <g>
    {/* 오른쪽 벽: 분류별 해결 수(2열) + 시계. 문(4~6) 오른쪽에 둔다. 분류가 4개를 넘으면 두 줄 높이에 맞게 줄인다. */}
    <OnWall wall="right" at={[6.1, 0, 3.8]}>
      <g transform={`scale(${Math.min(1, 2 / Math.ceil(stats.length / 2))})`}>
        {stats.map((stat, i) => <StatScreen key={stat.label} x={(i % 2) * 42} y={Math.floor(i / 2) * 25} stat={stat} />)}
      </g>
    </OnWall>
    <OnWall wall="right" at={[0.5, 0, 2.55]}>
      {/* "SHIFT 00:00"이 다 들어가는 폭. 오른쪽 벽 문(4~6) 바로 앞까지 쓴다. */}
      <rect width={76} height={16} rx={2} fill="#050a14" stroke={PLATINUM} strokeOpacity={0.6} />
      <text className="iso-clock" x={5} y={12}>{clock}</text>
    </OnWall>
    {/* 왼쪽 벽: 전체 진행 대형 화면과 캠퍼스 미니맵. 문(4~6)을 피해 둔다. */}
    <OnWall wall="left" at={[0, 9.7, 3.85]}>
      <rect width={74} height={40} rx={3} fill="#050a14" stroke={PLATINUM} strokeOpacity={0.6} />
      <text className="iso-screen-label" x={6} y={10}>TOTAL CLEARED</text>
      <text className="iso-big-value" x={6} y={29}>{total.cleared}<tspan className="iso-screen-label" dx={3}>/ {total.total}</tspan></text>
      <rect x={6} y={33} width={62} height={3} fill="#16233d" />
      <rect x={6} y={33} width={total.total ? 62 * total.cleared / total.total : 0} height={3} fill="#2cff8f" />
    </OnWall>
    <OnWall wall="left" at={[0, 3.6, 3.85]}><MiniMap rooms={rooms} /></OnWall>

    <DeskRow y={2.3} people={[{ shirt: "#2f7bff", hair: "#1b1b1b" }, { shirt: PLATINUM, hair: "#6b4a2f", skin: "#d9a77c" }, { shirt: "#14213d", hair: "#c98d4b" }]} />
    <DeskRow y={5.6} people={[{ shirt: "#00d4ff", hair: "#2a1d18" }, { shirt: "#1d2433", hair: "#121212", skin: "#b9835a" }]} />
    <Person at={[1.8, 9.3, 0]} facing="right" pose="walk" walkTo={[6.3, 9.3, 0]} shirt="#2f7bff" pants="#0e1526" hair="#6b4a2f" prop="tablet" duration={12} delay={-2} />
    <Box at={[8.3, 8.6, 0]} size={[0.9, 0.6, 0.9]} tone={GUNMETAL} />
    <Person at={[7.6, 9.3, 0]} facing="away-right" shirt={PLATINUM} pants="#14213d" hair="#2a1d18" prop="mug" />
  </g>;
}
