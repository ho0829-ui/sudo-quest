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
import { useCampusParty } from "./party/useCampusParty";
import { FINALE_NAME, PARTY_NAMES } from "../party";
import { upcomingIn } from "../../scenarios/upcoming";
import "./campus.css";
import "./party/party.css";

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
  onCommunity: () => void;
  onOpenScenario: (scenario: Scenario) => void;
  /** 모든 운영실을 해결했을 때: 피날레 열기(처음 한 번은 저절로)·엔딩 크레딧 열기 */
  onFinale?: () => void;
  onCredits?: () => void;
}

export function IsoCampus({ scenarios, progress, onEnterCategory, onOpenRecords, onExplore, onOpenScenario, onCommunity, onFinale, onCredits }: IsoCampusProps) {
  const [active, setActive] = useState<RoomKind | null>(null);
  // 마우스가 없는 화면(터치)에서는 호버가 없으므로 첫 탭은 방 정보 보기, 같은 방을 다시 누르면 입장한다.
  const touch = useMemo(() => window.matchMedia("(hover: none)").matches, []);
  const clock = useShiftClock();
  const stats = OPEN_CATEGORIES.map(c => ({ label: c.tag, ...roomStatus(c.id, scenarios, progress) }));
  const total = { label: "TOTAL", ...roomStatus("control", scenarios, progress) };
  const party = useCampusParty(scenarios, progress);
  // 마지막 운영실까지 해결하고 처음 홈에 오면 피날레를 한 번 연다(본 기록은 useCampusParty가 남긴다).
  useEffect(() => { if (party.kickoff.allClear) onFinale?.(); }, []);
  const mapRooms = ROOMS.map(room => ({ accent: THEMES[room.kind].accent, alarm: roomStatus(room.kind, scenarios, progress).alarm }));

  function enter(kind: RoomKind) {
    // 준비 중인 방은 들어가지 않고 안내만 띄운다(키보드·터치에서도 HUD로 알 수 있게 활성화).
    if (ROOMS.find(r => r.kind === kind)?.soon) setActive(kind);
    else if (kind === "control") onOpenRecords();
    else if (kind === "library") onExplore();
    else if (kind === "community") onCommunity();
    else onEnterCategory(kind);
  }

  const info = ROOMS.find(room => room.kind === active);
  const partying = info ? party.partyOf(info.kind) : false;
  const upcoming = info && info.kind in PARTY_NAMES ? upcomingIn(info.kind as Category).length : 0;
  const status = info ? roomStatus(info.kind, scenarios, progress) : null;
  const room = (kind: RoomKind, index: number) => {
    const spec = ROOMS.find(r => r.kind === kind)!;
    return <RoomShell key={kind} info={spec} status={roomStatus(kind, scenarios, progress)} theme={THEMES[kind]} doors={doorsOf(spec)}
      index={index} active={active === kind} party={party.partyOf(kind)} kickoff={party.kickoffOf(kind)}
      onHover={on => { if (!touch) setActive(current => on ? kind : current === kind ? null : current); }}
      onPress={() => { if (touch && active !== kind) setActive(kind); else enter(kind); }}
      onActivate={() => enter(kind)}>
      <RoomArt kind={kind} control={{ stats, total, clock: `SHIFT ${clock}`, rooms: mapRooms }}
        party={party.partyOf(kind)} kickoff={party.kickoffOf(kind)} accent={THEMES[kind].accent} />
    </RoomShell>;
  };

  return <div className={`iso-campus${active ? " has-active" : ""}`}>
    {party.toast && <div className="party-toast" role="status"><i />{party.toast}</div>}
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
        {partying && <span className="iso-hud-status party">
          {info.kind in PARTY_NAMES ? `${PARTY_NAMES[info.kind as Category]} 중` : info.kind === "control" ? `${FINALE_NAME} 중` : "케이크 배달 왔어요"}
        </span>}
        {upcoming > 0 && <span className="iso-hud-next">다음 실습 {upcoming}개 준비 중</span>}
        {info.soon
          ? <span className="iso-hud-status soon">OPENING SOON · {info.kind === "community" ? "게시판 준비 중" : "실습 준비 중"}</span>
          : <span className="iso-hud-enter">{touch ? "한 번 더 누르면 입장 →" : "클릭하거나 Enter로 입장 →"}</span>}
      </> : <>
        <span className="iso-hud-tag">INFRA CAMPUS · SHIFT {clock}</span>
        <strong>어느 방으로 출동할까요?</strong>
        <p>{touch ? "방을 누르면" : "방에 마우스를 올리면"} 어떤 장애를 다루는 곳인지 보여 줍니다.</p>
        <span className="iso-legend"><i className="alarm" /> 미해결 실습 있음 <i className="clear" /> 모두 해결
          {party.state.rooms.length > 0 && <><i className="party" /> 파티 중 {party.state.rooms.length}곳</>}</span>
        {party.state.allClear && onFinale && <span className="iso-allclear">
          <span className="iso-allclear-item">🎆 ALL CLEAR</span>
          <button type="button" className="iso-allclear-item" onClick={onFinale}>🎇 피날레 다시 보기</button>
          <button type="button" className="iso-allclear-item" onClick={onCredits}>🎬 엔딩 크레딧</button></span>}
      </>}
    </div>
  </div>;
}
