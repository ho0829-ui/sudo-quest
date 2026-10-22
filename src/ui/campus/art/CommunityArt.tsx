import { plane, points, project } from "../iso";
import { Box, Neon, OnWall } from "../parts";
import { WALL_HEIGHT } from "../rooms";
import { Bubble, CafeTable, CorkBoard, Counter, MenuBoard, Mug, PEACH, PendantLamp, Sofa, Stool, WARM_LIGHT } from "./cafe";
import { Plant } from "./fixtures";
import { Person } from "./people";
import { CommunityPartyCake } from "../party/control";

/**
 * 벽돌 벽과 아래 나무 판벽. 문(4~6)은 비워 두려고 벽을 구간으로 나눠 그린다.
 * top 위로는 벽돌 줄을 긋지 않는다(이름 간판이 있는 자리를 깨끗하게 둔다).
 */
function BrickWall({ wall, from, to, top = WALL_HEIGHT }: { wall: "left" | "right"; from: number; to: number; top?: number }) {
  const width = (to - from) * 22;
  const rows = [];
  for (let row = 0, y = (WALL_HEIGHT - top) * 22 + 4; y < (WALL_HEIGHT - 1.0) * 22; row++, y += 8) {
    rows.push(<line key={`h${y}`} x1={0} y1={y} x2={width} y2={y} />);
    for (let x = row % 2 ? 9 : 0; x < width; x += 18) rows.push(<line key={`v${y}-${x}`} x1={x} y1={y} x2={x} y2={y + 8} />);
  }
  const panel = (WALL_HEIGHT - 1.0) * 22;
  return <OnWall wall={wall} at={wall === "left" ? [0, to, WALL_HEIGHT] : [from, 0, WALL_HEIGHT]}>
    <g stroke="#5a2e20" strokeWidth={0.7} opacity={0.55}>{rows}</g>
    <rect x={0} y={panel} width={width} height={22} fill="#3a2214" />
    {Array.from({ length: Math.floor(width / 11) }, (_, i) => <line key={i} x1={i * 11 + 5} y1={panel + 2} x2={i * 11 + 5} y2={panel + 21} stroke="#2a180e" />)}
    <line x1={0} y1={panel} x2={width} y2={panel} stroke="#8a5f3b" strokeWidth={1.4} />
  </OnWall>;
}

/** 왼쪽 벽 창문: 밤거리 불빛, 달, 살구색 커튼. */
function Window() {
  return <OnWall wall="left" at={[0, 3.6, 3.85]}>
    <rect width={62} height={44} rx={3} fill="#5b3a22" />
    <rect x={3} y={3} width={56} height={38} fill="#0d1a33" />
    <circle cx={44} cy={11} r={4} fill="#fff4c2" />
    {[[6, 24, 10, 17], [18, 19, 9, 22], [29, 27, 12, 14], [43, 22, 12, 19]].map(([x, y, w, h]) => <g key={x}>
      <rect x={x} y={y} width={w} height={h} fill="#1b2540" />
      {[0, 1].map(k => <rect key={k} className="iso-lamp" x={x + 2 + k * 4} y={y + 3} width={2} height={2.4} fill={WARM_LIGHT} style={{ animationDelay: `${-x * 0.2 - k}s` }} />)}
    </g>)}
    <line x1={31} y1={3} x2={31} y2={41} stroke="#5b3a22" strokeWidth={2} />
    <line x1={3} y1={20} x2={59} y2={20} stroke="#5b3a22" strokeWidth={2} />
    <path d="M3,3 Q12,20 6,41 H3 Z M59,3 Q50,20 56,41 H59 Z" fill={PEACH} opacity={0.75} />
  </OnWall>;
}

/** 두 벽 윗선을 따라 늘어진 전구 줄. 전구마다 반짝이는 박자가 다르다. */
function StringLights() {
  const bulbs: [number, number][] = [];
  for (let y = 9.6; y > 0.3; y -= 0.8) bulbs.push([0, y]);
  for (let x = 0.4; x < 9.8; x += 0.8) bulbs.push([x, 0]);
  return <g>
    <polyline points={points(...bulbs.map(([x, y]) => [x, y, WALL_HEIGHT - 0.25] as [number, number, number]))} stroke="#2a180e" strokeWidth={0.7} fill="none" />
    {bulbs.map(([x, y], i) => {
      const [cx, cy] = project([x, y, WALL_HEIGHT - 0.32]);
      return <circle key={i} className="iso-led" cx={cx} cy={cy} r={1.7} fill={i % 3 ? WARM_LIGHT : PEACH} style={{ animationDelay: `${-(i * 0.43) % 2.4}s` }} />;
    })}
  </g>;
}

/**
 * 커뮤니티실(따뜻한 살구빛 카페): 벽돌 벽, 원목 마루, 바 카운터와 바리스타, 둥근 테이블에서 이야기하는 사람들,
 * 왼쪽 벽 코르크 게시판 앞에서 쪽지를 읽는 사람, 창가 소파와 낮잠 자는 고양이. 게시판 기능은 준비 중이다.
 */
export function CommunityArt() {
  return <g>
    {/* 원목 마루와 러그 */}
    {[1.1, 2.2, 3.3, 4.4, 5.5, 6.6, 7.7, 8.8].map(y => <polyline key={y} points={points([0, y, 0], [10, y, 0])} stroke="#3e2617" strokeWidth={0.8} />)}
    <polygon points={plane(2.9, 2.9, 4.6, 3.4, 0.01)} fill="#4a2219" />
    <Neon path={[[3.1, 3.1, 0.02], [7.3, 3.1, 0.02], [7.3, 6.1, 0.02], [3.1, 6.1, 0.02], [3.1, 3.1, 0.02]]} color={PEACH} width={0.6} />

    <BrickWall wall="left" from={0} to={4} />
    <BrickWall wall="left" from={6} to={10} />
    <BrickWall wall="right" from={0} to={4} top={2.0} />
    <BrickWall wall="right" from={6} to={10} />
    <Window />
    <CorkBoard at={[0, 9.6, 3.9]} />
    <MenuBoard at={[6.4, 0, 3.95]} />
    {/* 문 위 네온 커피잔 */}
    <OnWall wall="right" at={[4.25, 0, 3.95]}>
      <path d="M6,8 h20 v6 q0,8 -10,8 q-10,0 -10,-8z M26,10 q6,0 6,4 q0,4 -6,4" stroke={PEACH} strokeWidth={1.6} fill="none" />
      <path className="iso-steam" d="M12,6 q-2,-3 0,-5 M18,6 q-2,-3 0,-5" stroke={PEACH} strokeWidth={1.2} fill="none" />
    </OnWall>
    <StringLights />

    {/* 오른쪽 벽 앞 보드게임·책 선반(이름 간판 아래) */}
    <Box at={[0.5, 0.1, 0]} size={[2.7, 0.5, 1.8]} tone={["#7a5034", "#4a2c1a", "#3c2415"]} />
    <OnWall wall="right" at={[0.6, 0.61, 1.72]}>
      {[0, 1, 2].map(row => <g key={row}>
        <rect x={0} y={row * 13} width={55} height={11} fill="#2a180e" />
        {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={2 + k * 9} y={row * 13 + 2 + (k % 2)} width={7} height={9 - (k % 2)} fill={["#ff9a6b", "#ffd08a", "#7fc8a9", "#e06a6a", "#8fb3ff", "#f4f1ea"][(k + row * 2) % 6]} />)}
      </g>)}
    </OnWall>

    {/* 바 카운터 뒤 바리스타, 주문하는 손님 */}
    <Person at={[7.9, 0.4, 0]} facing="left" shirt="#f4f1ea" apron="#3b2a20" hair="#6b4a2f" />
    <Counter x={6.3} y={0.65} w={3.3} d={0.85} />
    <Person at={[7.4, 2.2, 0]} facing="away-right" shirt="#7fc8a9" pants="#2b3a55" hair="#121212" />
    <Plant at={[9.4, 2.4, 0]} />

    {/* 창가 소파에서 책 읽는 사람 */}
    <Box at={[1.55, 1.5, 0]} size={[0.8, 1.1, 0.35]} tone={["#c48a52", "#7a5034", "#5e3c26"]} />
    <Mug at={[1.8, 1.8, 0.35]} steam={-1.4} />
    <Sofa y0={0.7} y1={3.6} />
    <Person at={[1.2, 2.3, 0]} facing="right" pose="sit" shirt="#ffd08a" pants="#4a2c1a" hair="#2a1d18" prop="tablet" />

    {/* 테이블 1: 마주 앉아 이야기하는 두 사람 */}
    <Stool at={[3.35, 3.8]} />
    <Person at={[3.35, 3.8, 0]} facing="right" pose="sit" shirt="#c96a4a" pants="#1d2433" hair="#121212" prop="mug" />
    <CafeTable at={[4.2, 4.1]} mugs={[[-0.2, 0.1, -0.5], [0.25, -0.1]]} />
    <CommunityPartyCake />
    <Stool at={[5.05, 4.4]} />
    <Person at={[5.05, 4.4, 0]} facing="left" pose="sit" shirt="#8fb3ff" pants="#2b3a55" hair="#c98d4b" />
    <Bubble at={[3.35, 3.8, 2.0]} text="Q&A" delay={0} />
    <Bubble at={[5.05, 4.4, 2.0]} text="!" delay={-2} />

    {/* 테이블 2: 노트북으로 장애 후기를 쓰는 사람 */}
    <CafeTable at={[7.7, 4.6]} mugs={[[0.25, 0.1, -2]]} />
    <Stool at={[7.7, 5.45]} />
    <Person at={[7.7, 5.45, 0]} facing="away-right" pose="type" shirt="#3a5a40" hair="#2a1d18" delay={-0.2} />

    {/* 테이블 사이를 오가는 직원(쟁반 대신 머그잔) */}
    <Person at={[6.0, 1.9, 0]} facing="left" pose="walk" walkTo={[6.0, 6.6, 0]} shirt="#f4f1ea" apron="#3b2a20" hair="#121212" prop="mug" duration={11} delay={-5} />

    {/* 게시판 앞: 쪽지를 읽는 사람과 새 쪽지를 붙이는 사람 */}
    <Person at={[1.3, 7.4, 0]} facing="away-left" shirt="#e06a6a" pants="#1d2433" hair="#121212" />
    <Person at={[0.9, 8.7, 0]} facing="away-left" shirt="#f4d28a" pants="#2b3a55" hair="#6b4a2f" prop="tablet" />

    {/* 테이블 3: 스터디 두 사람 */}
    <Stool at={[5.2, 7.7]} />
    <Person at={[5.2, 7.7, 0]} facing="right" pose="sit" shirt="#ffb3c7" pants="#2b3a55" hair="#3b2a20" prop="laptop" />
    <CafeTable at={[6.1, 7.9]} mugs={[[-0.15, 0.15], [0.2, -0.1, -3]]} />
    <Stool at={[6.95, 8.2]} />
    <Person at={[6.95, 8.2, 0]} facing="left" pose="sit" shirt="#7fc8a9" pants="#1d2433" hair="#121212" />
    <Bubble at={[6.95, 8.2, 2.0]} text="LGTM" delay={-1} />
    <Plant at={[9.2, 9.2, 0]} scale={1.1} />

    <PendantLamp at={[4.2, 4.1]} />
    <PendantLamp at={[7.7, 4.6]} delay={-1.5} />
    <PendantLamp at={[6.1, 7.9]} delay={-3} />
  </g>;
}
