import { project } from "./iso";
import { Floor, Neon, Walls } from "./parts";
import { ROOM_SIZE, WALL_HEIGHT, type RoomKind } from "./rooms";
import { THEMES } from "./themes";
import { RoomArt } from "./art/RoomArt";

/**
 * 방 하나만 떼어 낸 작은 2.5D 장면. 실습 브리핑·미션 HUD·자료실 머리에 쓴다.
 * 장식이며 실제 서버 상태를 나타내지 않는다.
 */
export function RoomVignette({ kind, className }: { kind: Exclude<RoomKind, "control">; className?: string }) {
  const theme = THEMES[kind];
  const [, front] = project([ROOM_SIZE, ROOM_SIZE, 0]);
  return <svg className={`room-vignette ${className ?? ""}`} viewBox={`-205 ${-WALL_HEIGHT * 22 - 40} 410 ${front + WALL_HEIGHT * 22 + 52}`} aria-hidden="true">
    <g className="vignette-float">
      <Floor size={ROOM_SIZE} fill={theme.floor} grid={theme.grid} />
      <Walls size={ROOM_SIZE} height={WALL_HEIGHT} left={theme.wallLeft} right={theme.wallRight} trim={theme.accent} />
      <RoomArt kind={kind} />
      <Neon path={[[ROOM_SIZE, 0, 0.02], [ROOM_SIZE, ROOM_SIZE, 0.02], [0, ROOM_SIZE, 0.02]]} color={theme.accent} width={1.1} />
    </g>
  </svg>;
}

/** 이중 바닥 타공 타일 무늬. 페이지에 한 번만 두고 모든 2.5D 장면이 같이 쓴다. */
export function CampusDefs() {
  return <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true" focusable="false">
    <defs>
      <pattern id="perforated" width={4} height={4} patternUnits="userSpaceOnUse">
        <rect width={4} height={4} fill="#0f3a22" /><circle cx={2} cy={2} r={0.8} fill="#00ff66" opacity={0.55} />
      </pattern>
    </defs>
  </svg>;
}
