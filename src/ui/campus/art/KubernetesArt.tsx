import { points, project } from "../iso";
import { Box, Cylinder, OnWall } from "../parts";
import { BRASS, CrowsNest, HelmSymbol, HelmWheel, Hull, PirateFlag, Rigging, Sail, SHIP, WOOD } from "./ship";
import { Person } from "./people";

const SEA_LINE = "#2a6fb3";

/** 바다: 바닥 전체에 흐르는 물결과 배 뒤로 퍼지는 항적. */
function Sea() {
  return <g>
    {[0.9, 1.9, 2.9, 7.3, 8.3, 9.3].map((y, i) => <polyline key={y} className="iso-flow" points={points([0.3, y, 0.01], [9.7, y, 0.01])}
      stroke={SEA_LINE} strokeOpacity={0.55 - (i % 3) * 0.12} strokeWidth={1} style={{ animationDuration: `${3 + (i % 3)}s` }} />)}
    {[[2.2, 8.6], [6.4, 8.9], [8.4, 2.1], [3.6, 2.4], [7.6, 7.8]].map(([x, y]) =>
      <polyline key={`${x}-${y}`} className="iso-glint" points={points([x, y, 0.02], [x + 0.6, y, 0.02])} stroke="#cfe8ff" strokeWidth={1.2} />)}
    {/* 항적: 선미 뒤로 벌어지는 두 줄 */}
    <polyline className="iso-flow" points={points([1.3, 4.4, 0.02], [0.3, 3.6, 0.02])} stroke="#e6f4ff" strokeOpacity={0.6} strokeWidth={1.2} />
    <polyline className="iso-flow" points={points([1.3, 5.6, 0.02], [0.3, 6.6, 0.02])} stroke="#e6f4ff" strokeOpacity={0.6} strokeWidth={1.2} />
  </g>;
}

/** 오른쪽 벽 문(4~6)에서 바다로 나온 부두. 상자에 앉아 노트북을 두드리는 직원, 오가는 직원. */
function Pier() {
  return <g>
    {[4.1, 5.85].map(x => <Cylinder key={x} at={[x, 1.4, -0.1]} r={0.08} h={0.35} tone={WOOD} />)}
    <Box at={[4.0, 0, 0]} size={[2.0, 1.5, 0.22]} tone={["#a77b4f", "#5a3a22", "#4a2f1c"]} />
    {[0.3, 0.6, 0.9, 1.2].map(y => <polyline key={y} points={points([4.0, y, 0.22], [6.0, y, 0.22])} stroke="#6b4a2d" strokeWidth={0.7} />)}
    <Box at={[4.15, 0.35, 0.22]} size={[0.45, 0.45, 0.5]} tone={["#7eaaff", "#326ce5", "#2756b8"]} />
    <Person at={[4.4, 1.05, 0.22]} facing="right" pose="type" shirt="#2f4f7f" tie="#ffd447" hair="#6b4a2f" prop="laptop" />
    <Person at={[5.55, 0.25, 0.22]} facing="left" pose="walk" walkTo={[5.55, 1.25, 0.22]} shirt="#ffffff" tie="#326ce5" hair="#121212" prop="tablet" duration={8} />
  </g>;
}

/**
 * 등대: 앞 왼쪽 구석 바위 위 줄무늬 탑. 불빛은 방 바깥(왼쪽)으로 훑어 이름 간판·배를 가리지 않는다.
 * 뒤쪽에 두면 화면에서 돛대 망대와 겹쳐 앞쪽 구석에 둔다.
 */
function Lighthouse({ x, y }: { x: number; y: number }) {
  const [lx, ly] = project([x, y, 3.25]);
  const stripes = [0, 0.55, 1.1, 1.65, 2.2];
  return <g>
    <polygon points={points([x - 0.55, y - 0.5, 0], [x + 0.55, y - 0.55, 0], [x + 0.6, y + 0.55, 0], [x - 0.5, y + 0.6, 0])} fill="#2b3442" />
    <Box at={[x - 0.4, y - 0.4, 0]} size={[0.8, 0.8, 0.3]} tone={["#4a5668", "#2b3442", "#222a35"]} />
    {stripes.map((z, i) => <Cylinder key={z} at={[x, y, 0.3 + z]} r={0.32 - i * 0.03} h={0.55} tone={i % 2 ? ["#ff8a8a", "#e04646", "#b83434"] : ["#ffffff", "#e6ebf2", "#c9d1dc"]} />)}
    <Cylinder at={[x, y, 3.05]} r={0.2} h={0.32} tone={["#fff4c2", BRASS, "#d9a92e"]} />
    <polygon points={points([x - 0.25, y - 0.25, 3.37], [x + 0.25, y + 0.25, 3.37], [x, y, 3.75])} fill="#e04646" />
    <g transform={`translate(${lx},${ly})`}>
      <polygon className="iso-beam" points="0,0 -92,-14 -92,14" fill={BRASS} opacity={0.18} />
    </g>
  </g>;
}

/** 벽 장식: 오른쪽은 클러스터 보물 지도, 왼쪽은 둥근 현창·종·구명 튜브. */
function Walls() {
  return <g>
    <OnWall wall="right" at={[6.4, 0, 3.9]}>
      <path d="M0,2 L66,0 L68,38 L2,40 Z" fill="#e9d6a8" stroke="#a88a52" strokeWidth={1} />
      <text className="iso-board-title" x={5} y={9} fill="#7a3b1d">CLUSTER MAP</text>
      <path d="M12,30 Q24,14 36,26 T60,18" stroke="#c43c3c" strokeWidth={1} strokeDasharray="2 2" fill="none" />
      <ellipse cx={14} cy={30} rx={7} ry={4} fill="#9cc58a" /><path d="M10,26 l2,-3 l2,2 l2,-2 l2,3z" fill="#d9a92e" />
      {[[36, 26], [50, 30], [60, 18]].map(([x, y]) => <g key={x}><ellipse cx={x} cy={y} rx={5} ry={3} fill="#9cc58a" />
        <circle cx={x - 2} cy={y - 0.5} r={0.9} fill="#326ce5" /><circle cx={x + 1} cy={y - 0.5} r={0.9} fill="#326ce5" /></g>)}
      <text x={56} y={13} fill="#c43c3c" style={{ font: "700 7px var(--mono)" }}>X</text>
    </OnWall>
    <OnWall wall="left" at={[0, 7.0, 3.2]}>
      <circle r={17} fill="#0b1a33" stroke="#c9a24a" strokeWidth={3.4} />
      <circle cx={6} cy={-5} r={4.5} fill="#fff4c2" /><circle cx={8} cy={-6.5} r={4} fill="#0b1a33" />
      {[[-8, -7], [-3, 6], [-10, 3], [9, 7]].map(([x, y]) => <circle key={`${x}${y}`} className="iso-led" cx={x} cy={y} r={0.8} fill="#ffffff" style={{ animationDelay: `${x * 0.1}s` }} />)}
    </OnWall>
    <OnWall wall="left" at={[0, 5.6, 3.5]}>
      <path d="M-6,0 Q-6,-9 0,-10 Q6,-9 6,0 L8,3 H-8 Z" fill="#c9a24a" /><circle cx={0} cy={5} r={2} fill="#8a6a2a" />
    </OnWall>
    <OnWall wall="left" at={[0, 4.4, 2.2]}>
      <circle r={9} fill="none" stroke="#e04646" strokeWidth={4} />
      <circle r={9} fill="none" stroke="#ffffff" strokeWidth={4} strokeDasharray="7 7" />
      <g transform="translate(0,0)"><HelmSymbol r={3} color="#ffd447" /></g>
    </OnWall>
  </g>;
}

/** 갈매기 두 마리. 구름처럼 천천히 떠다닌다. */
function Gulls() {
  return <g>{([[3.6, 2.6, 6.4, 0], [6.8, 8.4, 5.4, -4]] as const).map(([x, y, z, delay]) => {
    const [gx, gy] = project([x, y, z]);
    return <g key={x} transform={`translate(${gx},${gy})`}>
      <path className="iso-cloud" d="M-6,0 q3,-4 6,0 q3,-4 6,0" stroke="#f4f6fb" strokeWidth={1.4} fill="none" style={{ animationDelay: `${delay}s` }} />
    </g>;
  })}</g>;
}

/**
 * 쿠버네티스 운영실(놋쇠 금빛 항해): 바다 위 해적선을 셔츠·넥타이 차림의 직원들이 몬다.
 * 키잡이는 일곱 살 조타륜을 잡고, 망대에서는 망원경으로 살피고, 갑판에는 파드 컨테이너와 etcd 보물상자.
 */
export function KubernetesArt() {
  const { S, D, yc } = SHIP;
  const main = 5.0;
  const fore = 7.0;
  return <g>
    <Sea />
    <Walls />
    <Lighthouse x={0.9} y={9.0} />
    <Pier />
    <g className="iso-sway">
      <Hull />
      <Rigging lines={[
        [[main, yc, 6.25], [S + 0.1, yc, D + 1.3]], [[main, yc, 6.25], [fore, yc, 5.25]], [[fore, yc, 5.25], [9.8, yc, D + 1.0]],
        [[main, yc, 4.0], [main - 0.5, 6.35, D]], [[main, yc, 4.0], [main - 0.5, 3.65, D]], [[fore, yc, 3.6], [fore - 0.4, 6.3, D]],
      ]} />
      {/* 선미 갑판, 등불, 키잡이와 조타륜 */}
      <Box at={[S, 3.6, D]} size={[1.8, 2.8, 0.7]} tone={WOOD} />
      <polyline points={points([S, 6.4, D + 1.0], [S + 1.8, 6.4, D + 1.0])} stroke={BRASS} strokeWidth={1.2} />
      {[S + 0.3, S + 0.9, S + 1.5].map(x => <polyline key={x} points={points([x, 6.4, D + 0.7], [x, 6.4, D + 1.0])} stroke="#c9a24a" strokeWidth={1} />)}
      <Box at={[S + 0.05, yc - 0.05, D + 0.7]} size={[0.1, 0.1, 0.6]} tone={WOOD} />
      <circle className="iso-lamp" cx={project([S + 0.1, yc, D + 1.4])[0]} cy={project([S + 0.1, yc, D + 1.4])[1]} r={4} fill={BRASS} />
      <Person at={[S + 1.15, yc, D + 0.7]} facing="right" shirt="#f4f6fb" tie="#326ce5" pants="#1d2433" hair="#2a1d18" hat={{ kind: "tricorn", color: "#16120c" }} />
      <HelmWheel at={[S + 1.62, yc, D + 1.45]} />

      {/* 파드 컨테이너와 etcd 보물상자 */}
      {[[3.4, 3.85, 0], [4.15, 3.85, 0], [3.4, 3.85, 0.5]].map(([x, y, z], i) =>
        <Box key={i} at={[x, y, D + z]} size={[0.7, 0.75, 0.5]} tone={i === 1 ? ["#7ff2df", "#1fb39b", "#178a78"] : ["#7eaaff", "#326ce5", "#2756b8"]} />)}
      <Box at={[3.3, 5.35, D]} size={[0.75, 0.55, 0.4]} tone={["#a77b4f", "#6b4426", "#5a3a22"]} />
      <Box className="iso-lamp" at={[3.3, 5.35, D + 0.4]} size={[0.75, 0.55, 0.06]} tone={[BRASS, "#d9a92e", "#ad8422"]} />
      <Person at={[3.4, 6.0, D]} facing="right" pose="walk" walkTo={[4.5, 6.0, D]} shirt="#bfe1ff" tie="#14213d" hair="#3b2a20" prop="tablet" duration={7} />

      {/* 주돛대: 돛 두 장(아래 돛에 조타륜 문장), 망대의 망꾼, 깃발 */}
      <Box at={[main - 0.07, yc - 0.07, D]} size={[0.14, 0.14, 5.0]} tone={WOOD} />
      <Sail x={main + 0.08} zTop={3.9} width={2.6} height={1.7} emblem />
      <Sail x={main + 0.08} zTop={5.55} width={2.0} height={1.2} />
      <CrowsNest at={[main, yc, 5.75]}>
        <Person at={[main, yc, 5.75]} facing="right" pose="sit" shirt="#cfe3ff" tie="#e04646" hair="#121212" prop="spyglass" />
      </CrowsNest>
      <PirateFlag at={[main, yc, 6.95]} />

      {/* 나무통 옆에서 밧줄을 당기는 직원 */}
      <Cylinder at={[6.2, 4.3, D]} r={0.26} h={0.5} tone={["#a77b4f", "#6b4426", "#5a3a22"]} />
      <Person at={[6.3, 6.05, D]} facing="left" shirt="#e8edf5" tie="#7a3b1d" pants="#3a2a1c" hair="#2a1d18" hat={{ kind: "beanie", color: "#e04646" }} />

      {/* 앞돛대와 뱃머리 망원경 직원 */}
      <Box at={[fore - 0.06, yc - 0.06, D]} size={[0.12, 0.12, 4.0]} tone={WOOD} />
      <Sail x={fore + 0.07} zTop={3.6} width={2.3} height={1.5} />
      <Sail x={fore + 0.07} zTop={4.95} width={1.7} height={0.95} />
      <Person at={[7.9, yc, D + 0.1]} facing="right" shirt="#ffffff" tie="#ffd447" apron="#2b3a55" hair="#c98d4b" prop="spyglass" />
      <polyline points={points([8.7, yc, D + 0.3], [9.8, yc, D + 1.0])} stroke="#5a3a22" strokeWidth={3} strokeLinecap="round" />
    </g>
    <Gulls />
  </g>;
}
