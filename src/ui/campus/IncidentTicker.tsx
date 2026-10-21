import type { Scenario } from "../../engine/scenario/types";
import type { Progress } from "../storage";
import { CATEGORIES } from "../categories";
import { THEMES } from "./themes";
const LEVELS = ["", "입문", "중급", "고급"];

/** 아직 풀지 않은 실습. 전광판은 실제 진행 기록만 보여 준다. */
export function pendingTickets(scenarios: Scenario[], progress: Progress): Scenario[] {
  return scenarios.filter(s => !progress[s.id]?.cleared);
}

/**
 * 출동 대기 티켓 전광판. 마우스를 올리거나 키보드로 들어오면 멈춰서 고를 수 있다.
 */
export function IncidentTicker({ scenarios, progress, onOpen }: { scenarios: Scenario[]; progress: Progress; onOpen: (scenario: Scenario) => void }) {
  const open = pendingTickets(scenarios, progress);
  if (open.length === 0) {
    return <div className="incident-ticker is-clear"><span className="ticker-label">QUEUE</span><span className="ticker-empty">대기 중인 장애 티켓이 없습니다. 모든 실습을 해결했어요.</span></div>;
  }
  const item = (s: Scenario, copy: number) => <li key={`${copy}-${s.id}`}>
    {/* 끊김 없이 흐르도록 목록을 두 번 그린다. 두 번째 복사본은 보조기기와 Tab 순서에서 뺀다. */}
    <button type="button" tabIndex={copy ? -1 : 0} aria-hidden={copy ? true : undefined} onClick={() => onOpen(s)}>
      <span className="ticker-tag" style={{ color: THEMES[s.category].accent }}>{CATEGORIES[s.category].tag}</span>
      <span>{s.title}</span>
      <span className="ticker-level">{LEVELS[s.difficulty]}</span>
    </button>
  </li>;
  return <div className="incident-ticker" role="region" aria-label={`출동 대기 티켓 ${open.length}건`}>
    <span className="ticker-label"><i /> QUEUE {String(open.length).padStart(2, "0")}</span>
    <div className="ticker-window">
      <ul className="ticker-track" style={{ animationDuration: `${Math.max(24, open.length * 6)}s` }}>
        {open.map(s => item(s, 0))}
        {open.map(s => item(s, 1))}
      </ul>
    </div>
  </div>;
}
