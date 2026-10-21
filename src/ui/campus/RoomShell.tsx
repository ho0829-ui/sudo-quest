import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { plane, points, project, UNIT } from "./iso";
import { Cylinder, Floor, Neon, OnWall, Walls } from "./parts";
import { ROOM_SIZE, WALL_HEIGHT, type RoomInfo, type RoomStatus } from "./rooms";
import type { RoomTheme } from "./themes";

interface RoomShellProps {
  info: RoomInfo;
  status: RoomStatus;
  theme: RoomTheme;
  /** 복도에서 들어오는 문. 벽 가운데(4~6)에 칠한다. */
  doors: ("left" | "right")[];
  index: number;
  active: boolean;
  onHover: (active: boolean) => void;
  /** 마우스·터치로 눌렀을 때. 터치 화면에서는 첫 탭을 미리 보기로 쓸 수 있게 따로 받는다. */
  onPress: () => void;
  /** 키보드 Enter·Space. 바로 입장한다. */
  onActivate: () => void;
  children: ReactNode;
}

function statusText({ total, cleared, alarm }: RoomStatus): string {
  if (alarm === null) return "";
  return alarm ? `미해결 ${total - cleared}개, 해결 ${cleared}/${total}` : `모두 해결 ${cleared}/${total}`;
}

/** 방 하나의 틀. 바닥·뒷벽·이름 간판·문·상태등과 호버·키보드 동작을 맡는다. */
export function RoomShell({ info, status, theme, doors, index, active, onHover, onPress, onActivate, children }: RoomShellProps) {
  const [ox, oy] = project([info.origin[0], info.origin[1], 0]);
  const label = `${info.name}. ${info.blurb}. ${info.soon ? "준비 중" : statusText(status)}`.trim();
  function onKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onActivate(); }
  }
  // SVG 속성에는 CSS 변수가 먹지 않아 style로 칠한다.
  const beacon = status.alarm === null ? null : status.alarm ? "var(--alert)" : "var(--ok)";
  // 경보등은 벽 모서리 위에 가는 기둥을 세워 띄운다. 모서리에 바로 얹으면 네온 테두리 이음새를 가려
  // 상자가 무너진 것처럼 보인다.
  const lamp = project([0, 0, WALL_HEIGHT + 1.15]);

  return <g className={`iso-room${active ? " is-active" : ""}`} transform={`translate(${ox},${oy})`}
    role="button" tabIndex={0} aria-label={label}
    onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
    onFocus={() => onHover(true)} onBlur={() => onHover(false)}
    onClick={onPress} onKeyDown={onKeyDown}>
    <g className="iso-room-enter" style={{ "--i": index } as CSSProperties}>
      <g className="iso-room-body">
        {/* 호버 때 방 아래에 드리우는 그림자. 방이 떠오르는 느낌을 준다. */}
        <polygon className="iso-room-shadow" points={plane(0.4, 0.4, ROOM_SIZE, ROOM_SIZE)} />
        <Floor size={ROOM_SIZE} fill={theme.floor} grid={theme.grid} />
        <Walls size={ROOM_SIZE} height={WALL_HEIGHT} left={theme.wallLeft} right={theme.wallRight} trim={theme.accent} />
        {doors.map(wall => <OnWall key={wall} wall={wall} at={wall === "right" ? [4, 0, 2.6] : [0, 6, 2.6]}>
          {/* 열린 문: 복도 불빛이 새어 들어오는 느낌으로 밝게 칠한다. */}
          <rect width={2 * UNIT} height={2.6 * UNIT} fill={theme.accent} opacity={0.16} />
          <rect width={2 * UNIT} height={2.6 * UNIT} fill="none" stroke={theme.accent} strokeWidth={1.6} strokeOpacity={0.85} />
          <rect x={3} y={2.6 * UNIT - 5} width={2 * UNIT - 6} height={3} fill={theme.accent} opacity={0.55} />
        </OnWall>)}
        <OnWall wall="right" at={[0.45, 0, 4]}>
          <text className="iso-tag" y={9} fill={theme.accent}>{info.tag}</text>
          <text className="iso-name" y={27}>{info.name}</text>
          {info.soon && <text className="iso-soon" y={39} fill={theme.accent}>OPENING SOON</text>}
        </OnWall>
        {children}
        {/* 바닥 앞 가장자리 네온: 방의 경계를 선으로 띄운다. */}
        <Neon path={[[ROOM_SIZE, 0, 0.02], [ROOM_SIZE, ROOM_SIZE, 0.02], [0, ROOM_SIZE, 0.02]]} color={theme.accent} width={1.1} />
        <polygon className="iso-room-outline" points={plane(0, 0, ROOM_SIZE, ROOM_SIZE)} stroke={theme.accent} />
        {beacon && <g className={`iso-beacon${status.alarm ? " alarm" : ""}`}>
          <polyline points={points([0, 0, WALL_HEIGHT], [0, 0, WALL_HEIGHT + 0.75])} stroke="#3a4554" strokeWidth={2} />
          <Cylinder at={[0, 0, WALL_HEIGHT + 0.75]} r={0.28} h={0.2} tone={["#2b3a5c", "#1a2744", "#111c33"]} />
          <circle cx={lamp[0]} cy={lamp[1]} r={14} style={{ fill: beacon }} opacity={0.22} />
          <circle className="iso-beacon-ping" cx={lamp[0]} cy={lamp[1]} r={8} fill="none" strokeWidth={2} style={{ stroke: beacon }} />
          <circle className="iso-beacon-light" cx={lamp[0]} cy={lamp[1]} r={7} style={{ fill: beacon }} />
        </g>}
      </g>
    </g>
  </g>;
}
