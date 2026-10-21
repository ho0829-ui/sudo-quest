import { useEffect, useState, type CSSProperties } from "react";
import type { Session } from "../../engine/session/session";
import { calculateScore } from "../../engine/session/score";
import { THEMES } from "../campus/themes";
import { CATEGORIES } from "../categories";
import { RoomVignette } from "../campus/RoomVignette";

function clock(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * 실습 화면 머리의 미션 HUD. 경과 시간·예상 점수·퀘스트 단계는 모두 실제 세션 값이다.
 * 시나리오 ID는 원인을 드러낼 수 있어(예: linux-disk-full) 쓰지 않고 실습 번호만 보여 준다.
 */
export function MissionHud({ session, missionNo }: { session: Session; missionNo: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const { scenario } = session;
  const score = calculateScore(session, now);
  const restored = scenario.resolution(session.state);
  const steps = [
    { label: "접속", done: true },
    { label: "원인 규명", done: session.causeSolved },
    { label: "복구", done: restored },
  ];
  const current = steps.findIndex(step => !step.done);

  return <section className="mission-hud" aria-label="미션 상황판" style={{ "--room": THEMES[scenario.category].accent } as CSSProperties}>
    <RoomVignette kind={scenario.category} className="mission-room" />
    <div className="mission-main">
      <div className="mission-kicker"><span className="mission-live" /> MISSION {String(missionNo).padStart(2, "0")} · {CATEGORIES[scenario.category].tag} · {CATEGORIES[scenario.category].room}</div>
      <h2>{scenario.title}</h2>
      <ol className="quest-steps">
        {steps.map((step, i) => <li key={step.label} className={step.done ? "done" : i === current ? "current" : undefined}>
          <span>{step.done ? "✓" : String(i + 1).padStart(2, "0")}</span>{step.label}
        </li>)}
      </ol>
    </div>
    <dl className="mission-stats">
      <div><dt>경과 시간</dt><dd>{clock(score.elapsedSeconds)}</dd></div>
      <div><dt>예상 점수</dt><dd>{score.total}<small className={`grade grade-${score.grade}`}>{score.grade}</small></dd></div>
      <div><dt>명령</dt><dd>{session.commands.length}</dd></div>
      <div><dt>힌트</dt><dd className="hint-pips" aria-label={`힌트 ${session.hintsUsed}/${scenario.hints.length} 사용`}>
        {scenario.hints.map((_, i) => <i key={i} className={i < session.hintsUsed ? "used" : undefined} />)}
      </dd></div>
    </dl>
  </section>;
}
