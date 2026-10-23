/**
 * 컨테이너 운영실 파티: "고래 풀 파티".
 * 운하가 수영장이 된다. 고래는 물 대신 꽃가루를 뿜고(Whale이 직접 바꾼다), 물 위엔 비치볼과 튜브,
 * 부두엔 선베드와 파라솔, 스낵 카운터 `docker run --rm snacks`, 크레인과 벽 사이 만국기.
 */
import type { CSSProperties } from "react";
import { points, project, type Point3 } from "../iso";
import { Box, Cylinder, OnWall } from "../parts";
import { TEAL } from "../art/dockerParts";
import { useParty } from "./context";
import { Confetti, Garland } from "./parts";

const COUNTER = { x: 6.6, y: 6.15, w: 3.0, d: 0.6, h: 0.85 };

/** 물 위의 비치볼과 튜브. 운하 바로 다음(부두보다 먼저) 그린다. */
export function DockerPartyPool() {
  if (!useParty()) return null;
  return <g>
    <BeachBall at={[2.2, 8.0, -0.3]} />
    <PoolRing at={[5.6, 7.85, -0.3]} />
  </g>;
}

function BeachBall({ at }: { at: Point3 }) {
  const [x, y] = project(at);
  return <g transform={`translate(${x},${y - 5})`}>
    <g className="iso-bob" style={{ animationDuration: "2.2s" } as CSSProperties}>
      <circle r={6} fill="#ffffff" />
      <path d="M0,-6 A6,6 0 0 1 5.2,3 L0,0z" fill="#ff5fa2" />
      <path d="M5.2,3 A6,6 0 0 1 -5.2,3 L0,0z" fill="#5cc8ff" />
      <path d="M-5.2,3 A6,6 0 0 1 0,-6 L0,0z" fill="#ffd447" />
      <circle r={1.4} fill="#ffffff" />
    </g>
  </g>;
}

function PoolRing({ at }: { at: Point3 }) {
  const [x, y] = project(at);
  return <g transform={`translate(${x},${y})`}>
    <g className="iso-bob" style={{ animationDelay: "-1s" } as CSSProperties}>
      <ellipse rx={11} ry={5} fill="none" stroke="#ff8a65" strokeWidth={4} />
      <ellipse rx={11} ry={5} fill="none" stroke="#ffffff" strokeWidth={4} strokeDasharray="6 6" />
    </g>
  </g>;
}

/** 부두: 선베드와 파라솔(왼쪽), 스낵 카운터(오른쪽, 안전모 작업자가 요리사가 된다). */
export function DockerPartyDeck() {
  if (!useParty()) return null;
  const { x, y, w, d, h } = COUNTER;
  const [ux, uy] = project([2.75, 6.3, 1.75]);
  return <g>
    {/* 선베드: 낮은 침대와 젖힌 등받이, 줄무늬 수건 */}
    <Box at={[1.3, 6.1, 0]} size={[1.25, 0.5, 0.22]} tone={["#f4f1ea", "#c9c2b3", "#a8a192"]} />
    <polygon points={points([1.3, 6.1, 0.22], [1.3, 6.6, 0.22], [1.0, 6.6, 0.75], [1.0, 6.1, 0.75])} fill="#e6dfd0" />
    {[0, 1, 2].map(i => <polygon key={i} points={points([1.6 + i * 0.25, 6.1, 0.23], [1.72 + i * 0.25, 6.1, 0.23], [1.72 + i * 0.25, 6.6, 0.23], [1.6 + i * 0.25, 6.6, 0.23])}
      fill={["#ff5fa2", TEAL, "#ffd447"][i]} />)}
    {/* 파라솔 */}
    <polyline points={points([2.75, 6.3, 0], [2.75, 6.3, 1.75])} stroke="#e6dfd0" strokeWidth={1.2} />
    <path d={`M${ux - 20},${uy + 6} Q${ux},${uy - 12} ${ux + 20},${uy + 6} Q${ux},${uy + 1} ${ux - 20},${uy + 6}z`} fill="#ff5fa2" />
    <path d={`M${ux - 7},${uy - 2} Q${ux},${uy - 8} ${ux + 7},${uy - 2} L${ux + 6},${uy + 3} Q${ux},${uy + 1} ${ux - 6},${uy + 3}z`} fill="#ffffff" opacity={0.85} />

    {/* 스낵 카운터와 줄무늬 차양 */}
    <Box at={[x, y, 0]} size={[w, d, h]} tone={["#f4f1ea", "#1fb39b", "#178a78"]} />
    <OnWall wall="right" at={[x + 0.1, y + d, h - 0.12]}>
      <text className="iso-party-tiny" x={0} y={0} fill="#06161b">docker run --rm snacks</text>
    </OnWall>
    {[[x + 0.5, y + 0.2], [x + 1.3, y + 0.3], [x + 2.2, y + 0.2]].map(([cx, cy], i) =>
      <Cylinder key={cx} at={[cx, cy, h]} r={0.16} h={0.12} tone={[["#ffd447", "#ff8a3d", "#7dff9b"][i], "#c9c2b3", "#a8a192"]} />)}
    {[x + 0.05, x + w - 0.1].map(px => <polyline key={px} points={points([px, y + d, h], [px, y + d, 2.45])} stroke="#e6dfd0" strokeWidth={1} />)}
    {[0, 1, 2, 3, 4, 5].map(i => <polygon key={i}
      points={points([x + i * w / 6, y - 0.3, 2.6], [x + (i + 1) * w / 6, y - 0.3, 2.6], [x + (i + 1) * w / 6, y + d + 0.15, 2.4], [x + i * w / 6, y + d + 0.15, 2.4])}
      fill={i % 2 ? "#ffffff" : "#ff8a65"} />)}
  </g>;
}

/** 크레인과 왼쪽 벽 사이 만국기, 꽃가루. 방 그림 맨 마지막에 그린다. */
export function DockerPartyGarland() {
  if (!useParty()) return null;
  return <g>
    <Garland from={[0.05, 4.6, 3.6]} to={[5.65, 1.85, 3.7]} count={12} sag={0.45} />
    <Confetti area={[1.0, 4.8, 8.5, 2.5]} z={3.0} count={14} seed={13} colors={[TEAL, "#ff5fa2", "#ffd447", "#ffffff"]} />
  </g>;
}
