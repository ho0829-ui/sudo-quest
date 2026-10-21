import { plane, points, project } from "../iso";
import { Box, Cylinder, Neon, type Tone } from "../parts";
import { Plant } from "./fixtures";
import { Chair, Person } from "./people";

const WOOD: Tone = ["#c99a6b", "#8a5f3b", "#6e4a2d"];
const GOLD = "#ffcf8a";
const SPINES = ["#00d4ff", "#ffcf8a", "#ff2d95", "#2cff8f", "#a259ff", "#ff7a1a", "#e6f1f8", "#8a5f3b"];
const SHELF_LEVELS = [0.15, 1.0, 1.85, 2.7];

/** 책 한 권을 선반 앞면에 그린다. along="y"면 x=면 위치, along="x"면 y=면 위치. */
function spine(along: "x" | "y", face: number, start: number, z: number, height: number, width: number) {
  const corners = along === "y"
    ? [[face, start, z], [face, start + width, z], [face, start + width, z + height], [face, start, z + height]]
    : [[start, face, z], [start + width, face, z], [start + width, face, z + height], [start, face, z + height]];
  return points(...(corners as [number, number, number][]));
}

/** 선반 한 칸에 책을 채운다. 높이·두께·색을 조금씩 바꿔 손때 묻은 서가처럼 보이게 한다. */
function Books({ along, face, from, to, z, seed }: { along: "x" | "y"; face: number; from: number; to: number; z: number; seed: number }) {
  const books = [];
  let pos = from;
  for (let i = seed; pos < to - 0.2; i++) {
    const width = 0.16 + ((i * 7) % 4) * 0.04;
    const height = 0.5 + ((i * 3) % 3) * 0.08;
    books.push(<polygon key={i} points={spine(along, face, pos, z, height, width)} fill={SPINES[i % SPINES.length]} />);
    pos += width + 0.03;
  }
  return <g>{books}</g>;
}

function Shelf({ along }: { along: "x" | "y" }) {
  // 왼쪽 벽 서가는 x=0~0.9, y=0.8~9.2. 오른쪽 벽 서가는 y=0~0.9, x=1.2~9.4(문 없음).
  const at: [number, number, number] = along === "y" ? [0.05, 0.8, 0] : [1.2, 0.05, 0];
  // 오른쪽 벽 서가는 이름 간판을 가리지 않게 한 칸 낮다.
  const levels = along === "y" ? SHELF_LEVELS : SHELF_LEVELS.slice(0, 3);
  const size: [number, number, number] = along === "y" ? [0.9, 8.4, 3.3] : [8.2, 0.9, 2.5];
  const face = 0.95;
  const span: [number, number] = along === "y" ? [0.9, 9.1] : [1.3, 9.3];
  return <g>
    <Box at={at} size={size} tone={WOOD} />
    {levels.map((z, row) => <g key={row}>
      <polygon points={along === "y"
        ? points([face, span[0], z], [face, span[1], z], [face, span[1], z + 0.75], [face, span[0], z + 0.75])
        : points([span[0], face, z], [span[1], face, z], [span[1], face, z + 0.75], [span[0], face, z + 0.75])} fill="#3a2717" />
      <Books along={along} face={face} from={span[0]} to={span[1]} z={z} seed={row * 5 + (along === "x" ? 2 : 0)} />
    </g>)}
  </g>;
}

/** 자료실(원목 + 금빛 조명): 두 벽 서가와 이동식 사다리, 러그, 독서 테이블과 스탠드, 지구본, 책 읽는 사람들. */
export function LibraryArt() {
  const [lx, ly] = project([5.6, 5.4, 1.75]);
  const [gx, gy] = project([8.6, 3.0, 1.35]);
  return <g>
    {/* 원목 마루 줄눈과 러그. */}
    {[1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5].map(y => <polyline key={y} points={points([1, y, 0], [10, y, 0])} stroke="#3d2b1e" strokeWidth={0.7} />)}
    <polygon points={plane(3.0, 3.4, 5.4, 4.6, 0.01)} fill="#1d2a44" />
    <Neon path={[[3.3, 3.7, 0.02], [8.1, 3.7, 0.02], [8.1, 7.7, 0.02], [3.3, 7.7, 0.02], [3.3, 3.7, 0.02]]} color={GOLD} width={0.7} />
    <Shelf along="y" />
    <Shelf along="x" />
    {/* 왼쪽 서가에 기댄 이동식 사다리와 책을 고르는 사람. */}
    <polyline points={points([1.7, 2.6, 0], [1.0, 2.6, 3.0])} stroke="#d9a76a" strokeWidth={1.8} />
    <polyline points={points([1.7, 3.3, 0], [1.0, 3.3, 3.0])} stroke="#d9a76a" strokeWidth={1.8} />
    {[0.5, 1.0, 1.5, 2.0, 2.5].map(z => <polyline key={z} points={points([1.7 - z * 0.23, 2.6, z], [1.7 - z * 0.23, 3.3, z])} stroke="#d9a76a" strokeWidth={1.2} />)}
    <Person at={[1.7, 6.4, 0]} facing="away-left" shirt="#ffcf8a" pants="#3a2a1d" hair="#2a1d18" />
    <Person at={[2.4, 1.7, 0]} facing="right" pose="walk" walkTo={[7.4, 1.7, 0]} shirt="#a259ff" pants="#2a1d18" hair="#7a3b1d" duration={14} delay={-7} />
    {/* 지구본. */}
    <Cylinder at={[8.6, 3.0, 0]} r={0.25} h={0.95} tone={["#8a5f3b", "#6e4a2d", "#5a3b23"]} />
    <circle cx={gx} cy={gy} r={10} fill="#1b6fa8" stroke={GOLD} strokeWidth={1.2} />
    <path d={`M${gx - 6},${gy - 3} q4,-4 8,0 q2,3 -2,5 M${gx + 2},${gy + 4} q3,1 4,-2`} stroke="#2fbf71" strokeWidth={2.2} fill="none" />
    {/* 독서 테이블, 문서 더미, 스탠드. */}
    <Box at={[4.2, 4.6, 0]} size={[3.0, 1.8, 0.8]} tone={WOOD} />
    <Box at={[4.5, 4.9, 0.8]} size={[0.9, 0.7, 0.25]} tone={["#f4f1ea", "#cfc8b8", "#b5ad9b"]} />
    <Box at={[4.55, 4.95, 1.05]} size={[0.8, 0.6, 0.06]} tone={["#00d4ff", "#0a7fa3", "#086580"]} />
    <Box at={[6.3, 5.2, 0.8]} size={[0.7, 0.5, 0.05]} tone={["#f4f1ea", "#cfc8b8", "#b5ad9b"]} />
    <Cylinder at={[5.6, 5.4, 0.8]} r={0.08} h={0.9} tone={["#d9c9a7", "#a89670", "#8a7a56"]} />
    <circle className="iso-lamp" cx={lx} cy={ly} r={28} fill={GOLD} opacity={0.25} />
    <Cylinder at={[5.6, 5.4, 1.6]} r={0.35} h={0.25} tone={["#ffe2ad", GOLD, "#e9a85a"]} />
    {/* 테이블 앞에 앉아 책을 읽는 두 사람. */}
    {[[4.9, "#2f7bff", "#121212"], [6.5, "#ff2d95", "#7a3b1d"]].map(([x, shirt, hair]) => <g key={x as number}>
      <Chair at={[x as number, 7.2, 0]} color="#4a3626" />
      <Person at={[x as number, 7.2, 0]} facing="away-right" pose="sit" shirt={shirt as string} hair={hair as string} />
    </g>)}
    <Plant at={[8.8, 8.7, 0]} />
  </g>;
}
