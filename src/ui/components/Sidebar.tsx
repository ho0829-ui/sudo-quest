import { useRef, useState } from "react";
import type { Session } from "../../engine/session/session";
import { hintPenaltyAt } from "../../engine/session/score";
import { CoachPanel } from "./CoachPanel";
import { HintGlossary } from "./HintGlossary";

interface SidebarProps {
  session: Session;
  onRevealHint: () => void;
  onOpenCause: () => void;
  onGiveUp: () => void;
  onUseCommand: (command: string) => void;
}

type Tab = "coach" | "status";

export function Sidebar({ session, onRevealHint, onOpenCause, onGiveUp, onUseCommand }: SidebarProps) {
  const { scenario, hintsUsed, commands, causeSolved, wrongAnswers } = session;
  const allHintsUsed = hintsUsed >= scenario.hints.length;
  // 코치를 기본 탭으로 둔다. 조사 중에 바로 물어볼 수 있어야 실제로 쓰게 된다.
  const [tab, setTab] = useState<Tab>("coach");
  const [unread, setUnread] = useState(false);
  // 답변은 몇 초 뒤에 오므로, 그때의 탭을 알기 위해 ref로도 들고 있는다.
  const tabRef = useRef<Tab>("coach");

  function select(next: Tab) {
    setTab(next);
    tabRef.current = next;
    if (next === "coach") setUnread(false);
  }

  return (
    <aside className="sidebar">
      <section className="panel">
        <h4>장애 티켓</h4>
        <div className="small">{scenario.title}</div>
        <p className="small muted" style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
          {scenario.ticket}
        </p>
      </section>

      <div className="sidebar-tabs" role="tablist" aria-label="조사 도구">
        <button role="tab" id="tab-coach" aria-selected={tab === "coach"} aria-controls="panel-coach" onClick={() => select("coach")}>
          AI 코치{unread && <span className="tab-badge" aria-label="새 답변">●</span>}
        </button>
        <button role="tab" id="tab-status" aria-selected={tab === "status"} aria-controls="panel-status" onClick={() => select("status")}>
          조사 현황 <small>힌트 {hintsUsed}/{scenario.hints.length}</small>
        </button>
      </div>

      {/* 탭을 바꿔도 코치 대화가 사라지지 않도록 숨기기만 한다. */}
      <div role="tabpanel" id="panel-coach" aria-labelledby="tab-coach" hidden={tab !== "coach"}>
        <CoachPanel session={session} onUseCommand={onUseCommand} onAnswer={() => { if (tabRef.current !== "coach") setUnread(true); }} />
      </div>

      <div role="tabpanel" id="panel-status" aria-labelledby="tab-status" hidden={tab !== "status"} className="sidebar-stack">
        <section className="panel">
          <h4>진행 상황</h4>
          <div className="small">
            <div>원인 규명: {causeSolved ? "✅ 완료" : "미완료"}</div>
            <div>복구 조치: {scenario.resolution(session.state) ? "✅ 완료" : "미완료"}</div>
            <div className="muted" style={{ marginTop: 6 }}>
              명령어 {commands.length}회 · 힌트 {hintsUsed}/{scenario.hints.length}
              {wrongAnswers.length > 0 && ` · 오답 ${wrongAnswers.length}회`}
            </div>
          </div>
        </section>

        <section className="panel">
          <h4>힌트</h4>
          {/* 힌트는 한 단계씩만 열린다. 정답을 바로 주지 않는 게 이 게임의 핵심이다. */}
          {scenario.hints.slice(0, hintsUsed).map((hint, index) => (
            <div key={index} className="hint">
              <strong className="small">{index + 1}단계</strong>
              <div>{hint}</div>
              <HintGlossary text={hint} before={scenario.hints.slice(0, index).join("\n")} />
            </div>
          ))}
          <button onClick={onRevealHint} disabled={allHintsUsed} style={{ width: "100%" }}>
            {allHintsUsed ? "힌트를 모두 봤습니다" : `힌트 열기 (-${hintPenaltyAt(hintsUsed)}점)`}
          </button>
        </section>

        <section className="panel">
          <h4>입력한 명령어</h4>
          {commands.length === 0 ? (
            <div className="small muted">아직 없습니다.</div>
          ) : (
            <ol className="command-log">
              {commands.map((command, index) => (
                <li key={index}>{command}</li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* 좁은 화면에서는 코치가 터미널 아래로 멀어지므로 바로 갈 수 있는 버튼을 띄운다(CSS로 넓은 화면에선 숨김). */}
      <button type="button" className="coach-jump" onClick={() => {
        select("coach");
        document.getElementById("panel-coach")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}>AI 코치{unread && <span className="tab-badge" aria-label="새 답변">●</span>}</button>

      <button className="primary cause-submit" onClick={onOpenCause} disabled={causeSolved}>
        {causeSolved ? "원인 규명 완료" : "원인 제출하기"}
      </button>
      <button className="small" onClick={onGiveUp}>
        포기하고 목록으로
      </button>
    </aside>
  );
}
