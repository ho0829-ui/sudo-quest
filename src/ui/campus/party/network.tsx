/**
 * 네트워크 운영실 파티: "핑퐁 대회".
 * ping을 주고받던 사람들이 진짜 탁구를 친다. 색색의 패치 케이블 깃발 줄, 탁구대와 오가는 공,
 * 천장에 매단 점수판 `PING 1ms · 0% loss`.
 */
import type { CSSProperties } from "react";
import { points, project } from "../iso";
import { Box, OnWall } from "../parts";
import { Person } from "../art/people";
import { useParty } from "./context";
import { Confetti, Garland } from "./parts";

const CABLES = ["#a259ff", "#00d4ff", "#ffd23f", "#ff2d95", "#00ff88"];
// 방 앞쪽은 앞 방의 뒷벽에 가려 보이지 않으므로, 라우터 줄과 장비 상자 사이(가운데)에 둔다.
const TABLE = { x: 5.4, y: 2.95, w: 2.0, d: 0.9, h: 0.72 };

/** 방을 가로지르는 패치 케이블 깃발 줄. 방 안 높은 곳이라 방 그림 맨 마지막에 그린다. */
export function NetworkPartyGarland() {
  if (!useParty()) return null;
  return <g>
    <Garland from={[0.05, 9.4, 3.5]} to={[9.6, 0.05, 3.5]} colors={CABLES} count={18} sag={0.7} />
    <Confetti area={[1.5, 2.0, 7.5, 4.5]} z={3.2} count={14} seed={5} colors={CABLES} />
  </g>;
}

/** 탁구대·선수 두 명·오가는 공·매단 점수판. */
export function NetworkPartyPingPong() {
  if (!useParty()) return null;
  const { x, y, w, d, h } = TABLE;
  const [ax, ay] = project([x + 0.3, y + d / 2, h + 0.25]);
  const [bx, by] = project([x + w - 0.3, y + d / 2, h + 0.25]);
  return <g>
    {/* 다리 네 개와 초록 상판, 흰 테두리·가운데 줄, 네트 */}
    {[[x + 0.15, y + 0.1], [x + w - 0.3, y + 0.1], [x + 0.15, y + d - 0.25], [x + w - 0.3, y + d - 0.25]].map(([lx, ly]) =>
      <Box key={`${lx}-${ly}`} at={[lx, ly, 0]} size={[0.12, 0.12, h]} tone={["#3a3f4a", "#22262e", "#1a1d24"]} />)}
    <Box at={[x, y, h]} size={[w, d, 0.08]} tone={["#1f7a4d", "#14532f", "#0f4026"]} />
    <polygon points={points([x + 0.05, y + 0.05, h + 0.081], [x + w - 0.05, y + 0.05, h + 0.081], [x + w - 0.05, y + d - 0.05, h + 0.081], [x + 0.05, y + d - 0.05, h + 0.081])}
      fill="none" stroke="#ffffff" strokeWidth={0.8} />
    <polyline points={points([x, y + d / 2, h + 0.081], [x + w, y + d / 2, h + 0.081])} stroke="#ffffff" strokeWidth={0.6} opacity={0.7} />
    <polygon points={points([x + w / 2, y - 0.05, h + 0.08], [x + w / 2, y + d + 0.05, h + 0.08], [x + w / 2, y + d + 0.05, h + 0.3], [x + w / 2, y - 0.05, h + 0.3])}
      fill="#e6f1f8" opacity={0.55} stroke="#ffffff" strokeWidth={0.5} />
    <circle className="iso-pong" cx={ax} cy={ay} r={1.7} fill="#ffb347"
      style={{ "--dx": `${bx - ax}px`, "--dy": `${by - ay}px` } as CSSProperties} />
    <Paddle at={[x - 0.15, y + 0.35, 1.0]} />
    <Paddle at={[x + w + 0.15, y + 0.6, 1.0]} />

    {/* 선수 두 명: 탁구대 짧은 변 양쪽 */}
    <Person at={[x - 0.4, y + 0.15, 0]} facing="right" shirt="#ff2d95" pants="#1b1b28" hair="#2a1d18" />
    <Person at={[x + w + 0.4, y + 0.65, 0]} facing="left" shirt="#00d4ff" pants="#14181f" hair="#c98d4b" />

    {/* 천장에 매단 점수판: 핑 응답처럼 쓴 경기 점수 */}
    <polyline points={points([x + 0.65, y, 3.4], [x + 0.65, y, 2.6])} stroke="#6b7280" strokeWidth={0.6} />
    <polyline points={points([x + 2.25, y, 3.4], [x + 2.25, y, 2.6])} stroke="#6b7280" strokeWidth={0.6} />
    <OnWall wall="right" at={[x + 0.4, y, 2.65]}>
      <rect width={45} height={14} rx={2} fill="#0b0912" stroke="#a259ff" />
      <text className="iso-party-tiny" x={22.5} y={6} textAnchor="middle" fill="#00ff88">PING 1ms</text>
      <text className="iso-party-tiny" x={22.5} y={11.5} textAnchor="middle" fill="#ffd23f">0% loss · 11 : 9</text>
    </OnWall>
  </g>;
}

function Paddle({ at }: { at: [number, number, number] }) {
  const [px, py] = project(at);
  return <g>
    <rect x={px - 0.6} y={py} width={1.2} height={3} fill="#7a5034" />
    <ellipse cx={px} cy={py - 1.5} rx={2.6} ry={3} fill="#e04646" />
  </g>;
}
