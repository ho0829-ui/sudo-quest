/**
 * 큰 사내 카페의 고정된 뒤쪽: 바닥·벽돌 벽·창문·코르크 게시판·메뉴판·입구·선반·긴 커피 바와 바리스타·
 * 음료 냉장고·TIL 무대와 화이트보드·창가 소파와 창가 바. 손님보다 늘 뒤에 있는 것만 여기서 그린다
 * (테이블·의자·부스·배경 직원·손님은 앞뒤를 섞어 그리므로 CafeScene에서).
 * 캠퍼스에 있는 펜던트 조명은 넣지 않는다. 손님이 커서 조명 갓이 뒤에 선 사람의 얼굴을 가리기 때문이다.
 */
import { backWalls, plane, points, project, UNIT } from "../../campus/iso";
import { Box, Neon, OnWall } from "../../campus/parts";
import { CorkBoard, Counter, MenuBoard, Mug, PEACH, Sofa, WARM_LIGHT } from "../../campus/art/cafe";
import { BrickWall, Window } from "../../campus/art/CommunityArt";
import { Person } from "../../campus/art/people";
import { BLOCKS, FLOOR } from "./floor";

const { w: W, d: D, wall: H } = FLOOR;
const BOOKS = ["#ff9a6b", "#ffd08a", "#7fc8a9", "#e06a6a", "#8fb3ff", "#f4f1ea"];

/** 두 벽 윗선을 따라 늘어진 전구 줄. */
function Lights() {
  const bulbs: [number, number][] = [];
  for (let y = D - 0.4; y > 0.3; y -= 0.8) bulbs.push([0, y]);
  for (let x = 0.4; x < W - 0.2; x += 0.8) bulbs.push([x, 0]);
  return <g>
    <polyline points={points(...bulbs.map(([x, y]) => [x, y, H - 0.25] as [number, number, number]))} stroke="#2a180e" strokeWidth={0.7} fill="none" />
    {bulbs.map(([x, y], i) => {
      const [cx, cy] = project([x, y, H - 0.32]);
      return <circle key={i} className="iso-led" cx={cx} cy={cy} r={1.7} fill={i % 3 ? WARM_LIGHT : PEACH} style={{ animationDelay: `${-(i * 0.43) % 2.4}s` }} />;
    })}
  </g>;
}

/** 오른쪽 끝 TIL 공유 무대: 낮은 단과 화이트보드. 발표자·청중은 배경 직원(staff.ts). */
function Stage() {
  const [x, y, w, d] = BLOCKS.stage;
  return <g>
    <OnWall wall="right" at={[x + 0.2, 0, 3.55]}>
      <rect width={58} height={34} rx={2} fill="#f4f6f8" stroke="#9aa6ae" strokeWidth={1.2} />
      <text className="cafe-board-title" x={5} y={9}>TIL 공유회</text>
      <path d="M6,15 h22 M6,20 h34 M6,25 h16" stroke="#326ce5" strokeWidth={1.2} />
      <path d="M40,16 l6,6 l8,-10" stroke="#e04646" strokeWidth={1.4} fill="none" />
    </OnWall>
    <Box at={[x, y, 0]} size={[w, d, 0.25]} tone={["#8a5f3b", "#5a3a22", "#4a2f1c"]} />
    <Neon path={[[x, y + d, 0.26], [x + w, y + d, 0.26]]} color={PEACH} width={0.7} />
  </g>;
}

/** 셀프 음료 냉장고: 유리문 너머 병들. */
function Fridge() {
  const [x, y, w, d] = BLOCKS.fridge;
  return <g>
    <Box at={[x, y, 0]} size={[w, d, 2.1]} tone={["#dfe6ec", "#9aa6ae", "#7f8892"]} />
    <OnWall wall="right" at={[x + 0.08, y + d, 1.95]}>
      <rect width={(w - 0.16) * UNIT} height={40} fill="#cfefff" opacity={0.55} />
      {[0, 1, 2, 3].map(row => [0, 1, 2].map(k => <rect key={`${row}-${k}`} x={2 + k * 5.6} y={3 + row * 9.5} width={3} height={7}
        fill={["#7dff9b", "#ff8a3d", "#5cc8ff"][(row + k) % 3]} />))}
    </OnWall>
  </g>;
}

/** 왼쪽 벽 창가 바: 좁은 원목 선반과 의자 셋(앉는 사람은 staff.ts). */
function WindowBar() {
  const [x, y, w, d] = BLOCKS.windowBar;
  return <g>
    <Box at={[x, y, 0.95]} size={[w, d, 0.08]} tone={["#d9b48a", "#8a5f3b", "#6e4a2d"]} />
    {[y + 0.3, y + d - 0.3].map(by => <Box key={by} at={[x + 0.1, by, 0]} size={[0.1, 0.1, 0.95]} tone={["#3c2415", "#2e1b10", "#24150c"]} />)}
  </g>;
}

export function CafeBack({ total }: { total: number | null }) {
  const walls = backWalls(0, 0, W, D, H);
  return <g>
    {/* 원목 마루와 가운데 큰 러그 */}
    <polygon points={plane(0, 0, W, D)} fill="#2e1d14" />
    {Array.from({ length: D - 1 }, (_, i) => i + 1).map(y => <polyline key={y} points={points([0, y, 0], [W, y, 0])} stroke="#3e2617" strokeWidth={0.8} />)}
    <polygon points={plane(3.0, 2.9, 15.0, 9.0, 0.01)} fill="#4a2219" opacity={0.85} />
    <Neon path={[[3.2, 3.1, 0.02], [17.8, 3.1, 0.02], [17.8, 11.7, 0.02], [3.2, 11.7, 0.02], [3.2, 3.1, 0.02]]} color={PEACH} width={0.6} />

    <polygon points={walls.left} fill="#3a1f16" />
    <polygon points={walls.right} fill="#45261a" />
    <BrickWall wall="left" from={0} to={D} />
    <BrickWall wall="right" from={0} to={4.5} />
    <BrickWall wall="right" from={6.5} to={W} />
    <Neon path={[[0, D, H], [0, 0, H], [W, 0, H]]} color={PEACH} width={1.4} />
    <Lights />

    {/* 오른쪽 벽: 입구(손님이 들어오는 문), 간판, 메뉴판 두 개 */}
    <OnWall wall="right" at={[4.5, 0, 2.6]}>
      <rect width={2 * UNIT} height={2.6 * UNIT} fill="#1a0f0a" />
      <rect width={2 * UNIT} height={2.6 * UNIT} fill={WARM_LIGHT} opacity={0.12} />
      <rect width={2 * UNIT} height={2.6 * UNIT} fill="none" stroke={PEACH} strokeWidth={1.4} />
    </OnWall>
    <OnWall wall="right" at={[4.2, 0, 3.95]}><text className="cafe-neon" fill={PEACH}>OPEN</text></OnWall>
    <OnWall wall="right" at={[0.7, 0, 3.95]}><text className="cafe-neon" fill={PEACH}>COMMUNITY LOUNGE</text></OnWall>
    <MenuBoard at={[9.6, 0, 3.95]} />
    <MenuBoard at={[13.6, 0, 3.95]} />
    <Stage />
    <Fridge />

    {/* 왼쪽 벽: 창문 둘(소파 위·창가 바 위), 코르크 게시판과 실제 글 수 */}
    <Window at={[0, 4.4, 3.85]} />
    <Window at={[0, 12.6, 3.85]} />
    <CorkBoard at={[0, 8.3, 3.9]} />
    <OnWall wall="left" at={[0, 8.2, 1.65]}>
      <rect width={64} height={13} rx={2} fill="#1f2b24" stroke="#5b3a22" strokeWidth={1.4} />
      <text className="iso-chalk" x={5} y={8.6}>{total === null ? "오늘의 이야기 —" : `오늘의 이야기 ${total}`}</text>
    </OnWall>

    {/* 오른쪽 벽 앞 보드게임 선반 */}
    <Box at={[0.5, 0.1, 0]} size={[3.0, 0.5, 1.8]} tone={["#7a5034", "#4a2c1a", "#3c2415"]} />
    <OnWall wall="right" at={[0.6, 0.61, 1.72]}>
      {[0, 1, 2].map(row => <g key={row}>
        <rect y={row * 13} width={62} height={11} fill="#2a180e" />
        {Array.from({ length: 7 }, (_, k) => <rect key={k} x={2 + k * 8.6} y={row * 13 + 2 + (k % 2)} width={7} height={9 - (k % 2)} fill={BOOKS[(k + row * 2) % 6]} />)}
      </g>)}
    </OnWall>

    {/* 긴 커피 바 뒤 바리스타 둘(손님이 아닌 직원) */}
    <Person at={[11.0, 0.35, 0]} facing="left" shirt="#f4f1ea" apron="#3b2a20" hair="#6b4a2f" />
    <Person at={[15.2, 0.35, 0]} facing="right" shirt="#f4f1ea" apron="#3b2a20" hair="#121212" skin="#e0b48a" />
    <Counter x={BLOCKS.counter[0]} y={BLOCKS.counter[1]} w={BLOCKS.counter[2]} d={BLOCKS.counter[3]} />

    {/* 창가 소파와 낮은 탁자, 창가 바 */}
    <Sofa y0={1.0} y1={3.8} />
    <Box at={[1.6, 1.6, 0]} size={[0.8, 1.2, 0.35]} tone={["#c48a52", "#7a5034", "#5e3c26"]} />
    <Mug at={[1.9, 2.0, 0.35]} steam={-1.4} />
    <WindowBar />
  </g>;
}
