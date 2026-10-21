import type { Session } from "../../engine/session/session";
import { CoachPanel } from "./CoachPanel";

interface SidebarProps {
  session: Session;
  onRevealHint: () => void;
  onOpenCause: () => void;
  onGiveUp: () => void;
}

export function Sidebar({ session, onRevealHint, onOpenCause, onGiveUp }: SidebarProps) {
  const { scenario, hintsUsed, commands, causeSolved, wrongAnswers } = session;
  const allHintsUsed = hintsUsed >= scenario.hints.length;

  return (
    <aside className="sidebar">
      <section className="panel">
        <h4>장애 티켓</h4>
        <div className="small">{scenario.title}</div>
        <p className="small muted" style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
          {scenario.ticket}
        </p>
      </section>

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
          </div>
        ))}
        <button onClick={onRevealHint} disabled={allHintsUsed} style={{ width: "100%" }}>
          {allHintsUsed ? "힌트를 모두 봤습니다" : `힌트 열기 (-60점)`}
        </button>
      </section>

      <CoachPanel session={session} />

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

      <button className="primary" onClick={onOpenCause} disabled={causeSolved}>
        {causeSolved ? "원인 규명 완료" : "원인 제출하기"}
      </button>
      <button className="small" onClick={onGiveUp}>
        포기하고 목록으로
      </button>
    </aside>
  );
}
