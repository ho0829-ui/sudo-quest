import { useEffect, useMemo, useState } from "react";
import type { Category, Scenario } from "../../engine/scenario/types";
import type { Progress } from "../storage";
import { ROOMS, roomRank, roomStatus, type RoomKind } from "./rooms";
import { RoomShell } from "./RoomShell";
import { THEMES } from "./themes";
import { RoomArt } from "./art/RoomArt";
import { Corridor, Ground } from "./CampusGround";
import { campusViewBox, CORRIDORS, doorsOf, MAX_RANK } from "./layout";
import { IncidentTicker } from "./IncidentTicker";
import { OPEN_CATEGORIES } from "../categories";
import "./campus.css";

const VIEW_BOX = campusViewBox();
const RANKS = Array.from({ length: MAX_RANK + 1 }, (_, rank) => rank);

function useShiftClock(): string {
  const format = () => new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const [time, setTime] = useState(format);
  useEffect(() => {
    const timer = window.setInterval(() => setTime(format()), 20000);
    return () => window.clearInterval(timer);
  }, []);
  return time;
}

interface IsoCampusProps {
  scenarios: Scenario[];
  progress: Progress;
  onEnterCategory: (category: Category) => void;
  onOpenRecords: () => void;
  onExplore: () => void;
  onOpenScenario: (scenario: Scenario) => void;
}

export function IsoCampus({ scenarios, progress, onEnterCategory, onOpenRecords, onExplore, onOpenScenario }: IsoCampusProps) {
  const [active, setActive] = useState<RoomKind | null>(null);
  // 마우스가 없는 화면(터치)에서는 호버가 없으므로 첫 탭은 방 정보 보기, 같은 방을 다시 누르면 입장한다.
  const touch = useMemo(() => window.matchMedia("(hover: none)").matches, []);
  const clock = useShiftClock();
  const stats = OPEN_CATEGORIES.map(c => ({ label: c.tag, ...roomStatus(c.id, scenarios, progress) }));
  const total = { label: "TOTAL", ...roomStatus("control", scenarios, progress) };
  const mapRooms = ROOMS.map(room => ({ accent: THEMES[room.kind].accent, alarm: roomStatus(room.kind, scenarios, progress).alarm }));

  function enter(kind: RoomKind) {
    // 준비 중인 방은 들어가지 않고 안내만 띄운다(키보드·터치에서도 HUD로 알 수 있게 활성화).
    if (ROOMS.find(r => r.kind === kind)?.soon) setActive(kind);
    else if (kind === "control") onOpenRecords();
    else if (kind === "library") onExplore();
    else if (kind !== "community") onEnterCategory(kind);
  }

  const info = ROOMS.find(room => room.kind === active);
  const status = info ? roomStatus(info.kind, scenarios, progress) : null;
  const room = (kind: RoomKind, index: number) => {
    const spec = ROOMS.find(r => r.kind === kind)!;
    return <RoomShell key={kind} info={spec} status={roomStatus(kind, scenarios, progress)} theme={THEMES[kind]} doors={doorsOf(spec)}
      index={index} active={active === kind}
      onHover={on => { if (!touch) setActive(current => on ? kind : current === kind ? null : current); }}
      onPress={() => { if (touch && active !== kind) setActive(kind); else enter(kind); }}
      onActivate={() => enter(kind)}>
      <RoomArt kind={kind} control={{ stats, total, clock: `SHIFT ${clock}`, rooms: mapRooms }} />
    </RoomShell>;
  };

  return <div className={`iso-campus${active ? " has-active" : ""}`}>
    <IncidentTicker scenarios={scenarios} progress={progress} onOpen={onOpenScenario} />
    <svg className="iso-map" viewBox={VIEW_BOX} role="group" aria-label="인프라 캠퍼스 지도. 방을 고르면 해당 실습이나 화면으로 이동합니다.">
      <Ground />
      <g className="iso-float">
        {RANKS.map(rank => <g key={rank}>
          {ROOMS.filter(r => roomRank(r) === rank).map(r => room(r.kind, ROOMS.indexOf(r)))}
          {CORRIDORS.filter(c => c.rank === rank).map(c => <Corridor key={`${c.x}-${c.y}`} spec={c} />)}
        </g>)}
      </g>
    </svg>
    <div className="iso-hud" aria-live="polite">
      {info && status ? <>
        <span className="iso-hud-tag" style={{ color: THEMES[info.kind].accent }}>{info.tag}</span>
        <strong>{info.name}</strong>
        <p>{info.blurb}</p>
        {status.alarm !== null && <span className={`iso-hud-status ${status.alarm ? "alarm" : "clear"}`}>
          {status.alarm ? `미해결 ${status.total - status.cleared}개 · 해결 ${status.cleared}/${status.total}` : `모두 해결 · ${status.cleared}/${status.total}`}
        </span>}
        {info.soon
          ? <span className="iso-hud-status soon">OPENING SOON · {info.kind === "community" ? "게시판 준비 중" : "실습 준비 중"}</span>
          : <span className="iso-hud-enter">{touch ? "한 번 더 누르면 입장 →" : "클릭하거나 Enter로 입장 →"}</span>}
      </> : <>
        <span className="iso-hud-tag">INFRA CAMPUS · SHIFT {clock}</span>
        <strong>어느 방으로 출동할까요?</strong>
        <p>{touch ? "방을 누르면" : "방에 마우스를 올리면"} 어떤 장애를 다루는 곳인지 보여 줍니다.</p>
        <span className="iso-legend"><i className="alarm" /> 미해결 실습 있음 <i className="clear" /> 모두 해결</span>
      </>}
    </div>
  </div>;
}
