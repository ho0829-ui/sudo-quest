/**
 * 쿠버네티스 운영실 파티: "선상 보물 연회".
 * 돛대 사이에 만국기, 뱃머리 쪽 줄에 등불, 활짝 열린 etcd 보물상자와 금화,
 * 주기적으로 꽃가루를 쏘는 축포, 바다 위 하늘의 불꽃놀이. 선원들은 Person이 알아서 춤춘다.
 */
import type { CSSProperties } from "react";
import { points, project, type Point3 } from "../iso";
import { Box } from "../parts";
import { BRASS, SHIP } from "../art/ship";
import { useParty } from "./context";
import { CONFETTI, Confetti, Garland, StringLights } from "./parts";

const { S, D, yc } = SHIP;
const MAIN = 5.0;
const FORE = 7.0;
const CHEST = { x: 3.3, y: 5.35, w: 0.75, d: 0.55, h: 0.4 };

/** 열린 보물상자: 세운 뚜껑, 쌓인 금화, 반짝임. 배 안(흔들리는 그룹) 상자 바로 다음에 그린다. */
export function KubernetesPartyTreasure() {
  if (!useParty()) return null;
  const { x, y, w, h } = CHEST;
  const top = D + h;
  const coins: Point3[] = [[x + 0.2, y + 0.2, top], [x + 0.45, y + 0.15, top + 0.04], [x + 0.35, y + 0.35, top + 0.08], [x + 0.55, y + 0.38, top], [x + 0.15, y + 0.42, top + 0.02]];
  return <g>
    <polygon points={points([x, y, top], [x + w, y, top], [x + w, y - 0.18, top + 0.5], [x, y - 0.18, top + 0.5])} fill="#6b4426" stroke={BRASS} strokeWidth={0.8} />
    {coins.map((c, i) => {
      const [cx, cy] = project(c);
      return <ellipse key={i} cx={cx} cy={cy - 1.5} rx={3.2} ry={1.8} fill={i % 2 ? "#ffd447" : "#f5b82e"} stroke="#ad8422" strokeWidth={0.4} />;
    })}
    {[[-4, -6], [5, -9], [1, -12]].map(([dx, dy], i) => {
      const [cx, cy] = project([x + 0.38, y + 0.28, top]);
      return <path key={i} className="iso-sparkle" d={`M${cx + dx},${cy + dy - 2} l0.7,1.3 l1.3,0.7 l-1.3,0.7 l-0.7,1.3 l-0.7,-1.3 l-1.3,-0.7 l1.3,-0.7z`}
        fill="#fff4c2" style={{ animationDelay: `${-i * 0.6}s` } as CSSProperties} />;
    })}
  </g>;
}

/** 돛대 사이 만국기, 뱃머리 등불, 갑판 축포. 배 안(흔들리는 그룹) 맨 마지막에 그린다. */
export function KubernetesPartyRigging() {
  if (!useParty()) return null;
  const muzzle = project([6.95, 3.62, D + 0.6]);
  return <g>
    <Garland from={[S + 0.1, yc, D + 1.3]} to={[MAIN, yc, 6.1]} count={10} sag={0.15} />
    <Garland from={[MAIN, yc, 6.1]} to={[FORE, yc, 5.15]} count={6} sag={0.15} />
    <StringLights from={[FORE, yc, 4.0]} to={[9.75, yc, D + 1.0]} colors={[BRASS, "#ff8a3d", "#fff4c2"]} count={7} sag={0.2} />
    {/* 축포: 갑판 위 작은 대포. 몇 초마다 꽃가루 부채가 터진다. */}
    <Box at={[6.65, 3.75, D]} size={[0.35, 0.35, 0.2]} tone={["#a77b4f", "#6b4426", "#5a3a22"]} />
    <polygon points={points([6.75, 3.85, D + 0.2], [6.9, 3.85, D + 0.2], [7.0, 3.65, D + 0.55], [6.85, 3.65, D + 0.6])} fill="#2b3442" />
    <g className="iso-cannon-shot">
      {CONFETTI.map((color, i) => {
        const angle = -Math.PI / 2 - 0.7 + i * 0.22;
        return <rect key={color} x={muzzle[0] + Math.cos(angle) * (10 + i * 2)} y={muzzle[1] + Math.sin(angle) * (12 + (i % 3) * 3)}
          width={2.6} height={1.4} fill={color} />;
      })}
    </g>
  </g>;
}

/** 바다 위 하늘의 불꽃놀이 두 송이와 꽃가루. 방 그림 맨 마지막에 그린다. */
export function KubernetesPartySky() {
  if (!useParty()) return null;
  return <g>
    <Firework at={[1.2, 1.6, 5.2]} color="#ffd447" delay={0} />
    <Firework at={[2.2, 8.4, 4.4]} color="#ff5fa2" delay={-1.6} />
    <Confetti area={[2.0, 3.5, 6.5, 3.0]} z={4.6} count={14} seed={17} colors={[BRASS, "#ff5fa2", "#5cc8ff", "#ffffff"]} />
  </g>;
}

function Firework({ at, color, delay }: { at: Point3; color: string; delay: number }) {
  const [x, y] = project(at);
  return <g className="iso-cannon-shot" style={{ animationDelay: `${delay}s`, animationDuration: "3.2s" } as CSSProperties}>
    {Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return <line key={i} x1={x + Math.cos(a) * 3} y1={y + Math.sin(a) * 3} x2={x + Math.cos(a) * 11} y2={y + Math.sin(a) * 11}
        stroke={i % 2 ? color : "#ffffff"} strokeWidth={1.2} strokeLinecap="round" />;
    })}
  </g>;
}
