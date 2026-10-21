import { project, UNIT } from "../iso";
import { Box, Cylinder, OnWall, Wire, type Tone } from "../parts";
import { Camera, GUNMETAL, Monitor, Plant, Rack } from "./fixtures";
import { Chair, Person } from "./people";

const MAGENTA = "#ff2d95";
const DISK: Tone = ["#3a1a2c", "#1f0d18", "#160912"];

/** DB 한 대: 어두운 디스크 세 장 사이마다 네온 테를 두르고, 맨 위 테는 숨 쉬듯 빛난다. */
function Database({ x, y, delay }: { x: number; y: number; delay: number }) {
  const rx = 0.65 * Math.SQRT2 * Math.cos(Math.PI / 6) * UNIT;
  const ry = 0.65 * Math.SQRT2 * 0.5 * UNIT;
  return <g>
    {[0, 0.6, 1.2].map(z => {
      const [cx, cy] = project([x, y, z + 0.5]);
      return <g key={z}>
        <Cylinder at={[x, y, z]} r={0.65} h={0.5} tone={DISK} />
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="none" stroke={MAGENTA} strokeWidth={1.2} opacity={0.8} />
      </g>;
    })}
    <ellipse className="iso-glow-ring" cx={project([x, y, 1.7])[0]} cy={project([x, y, 1.7])[1]} rx={rx + 4} ry={ry + 2.5}
      fill="none" stroke={MAGENTA} strokeWidth={2} style={{ animationDelay: `${delay}s` }} />
  </g>;
}

/** 배포 파이프라인 보드. 단계 사이를 빛 점이 지나간다(장식이며 실제 배포 상태가 아니다). */
function PipelineBoard() {
  // 단계 칸은 가장 긴 "DEPLOY"가 들어가는 폭(21). 보드는 문(4~6) 오른쪽 벽 끝까지(6.4~9.85) 쓴다.
  return <OnWall wall="right" at={[6.4, 0, 3.7]}>
    <rect width={76} height={34} rx={3} fill="#12070e" stroke={MAGENTA} strokeOpacity={0.7} />
    <text className="iso-board-title" x={5} y={9} fill={MAGENTA}>CI / CD</text>
    {["BUILD", "TEST", "DEPLOY"].map((stage, i) => <g key={stage} transform={`translate(${4 + i * 23.5},14)`}>
      <rect width={21} height={12} rx={2} fill="#1f0d18" stroke={i === 2 ? "#00ff88" : MAGENTA} />
      <text className="iso-stage-label" x={10.5} y={7.8} textAnchor="middle" fill="#ffd6ea">{stage}</text>
    </g>)}
    <circle className="iso-pipeline-dot" cx={5} cy={30} r={1.6} fill="#00ff88" />
  </OnWall>;
}

/** 웹·DB 운영실(네온 마젠타): 스토리지·앱 서버 랙, 복제되는 DB 세 대, 배포 보드, 인증서, 개발자 책상 두 개. */
export function WebDbArt() {
  return <g>
    <PipelineBoard />
    {/* 왼쪽 벽: 네온 </> 사인과 인증서 액자. */}
    <OnWall wall="left" at={[0, 9.4, 3.9]}>
      <text className="iso-neon-sign" y={14} fill={MAGENTA}>{"</>"}</text>
      <rect x={2} y={26} width={46} height={32} fill="#fff5e6" stroke="#d9a441" strokeWidth={2} />
      <rect x={8} y={33} width={24} height={2.5} fill="#c7b38a" />
      <rect x={8} y={39} width={18} height={2.5} fill="#c7b38a" />
      <circle cx={38} cy={50} r={5.5} fill="#ffb547" />
    </OnWall>
    <Camera at={[0.05, 1.4, 3.3]} />

    {/* 스토리지 랙(디스크 칸이 촘촘)과 앱 서버 랙. */}
    <Rack x={1.0} y={1.3} accent={MAGENTA} seed={1} leds={[MAGENTA, "#ff8cc6", "#00d4ff"]} />
    <Rack x={2.25} y={1.3} accent={MAGENTA} seed={4} leds={[MAGENTA, "#ffffff"]} />
    <Rack x={3.5} y={1.3} accent={MAGENTA} seed={2} leds={["#00d4ff", MAGENTA]} />

    {/* DB 클러스터: 주(primary)에서 두 복제본으로 흐르는 복제선. */}
    <Database x={6.6} y={2.4} delay={0} />
    <Wire from={[6.6, 2.4, 1.7]} to={[8.4, 3.8, 1.7]} color={MAGENTA} flow bend={-16} width={1.4} />
    <Wire from={[6.6, 2.4, 1.7]} to={[6.5, 4.9, 1.7]} color={MAGENTA} flow bend={-16} width={1.4} />
    <Database x={8.4} y={3.8} delay={-0.8} />
    <Database x={6.5} y={4.9} delay={-1.6} />
    <Wire from={[3.7, 2.4, 2.0]} to={[6.6, 2.4, 1.7]} color="#00d4ff" flow bend={-10} />

    {/* 개발자 책상 두 개와 근무자. */}
    {[[0.9, 6.6], [4.7, 6.9]].map(([x, y], i) => <g key={x}>
      <Box at={[x, y, 0]} size={[2.6, 0.9, 0.78]} tone={GUNMETAL} />
      <Monitor at={[x + 0.3, y + 0.15, 0.78]} glow={i ? "#00d4ff" : MAGENTA} lines={4} />
      <Monitor at={[x + 1.35, y + 0.15, 0.78]} glow={MAGENTA} lines={4} />
      <Chair at={[x + 1.2, y + 1.75, 0]} />
      <Person at={[x + 1.2, y + 1.75, 0]} facing="away-right" pose="type" shirt={i ? "#ffd23f" : "#3a1a2c"}
        hair={i ? "#121212" : "#7a3b1d"} skin={i ? "#e0b48a" : "#f2c9a0"} delay={-i * 0.4} />
    </g>)}
    {/* 두 책상 사이 통로를 오가는 개발자(커피를 들고). */}
    <Person at={[4.1, 5.5, 0]} facing="left" pose="walk" walkTo={[4.1, 9.2, 0]} shirt="#ff2d95" pants="#1d1d28" hair="#121212" prop="mug" duration={10} delay={-4} />
    <Plant at={[9.2, 9.1, 0]} />
  </g>;
}
