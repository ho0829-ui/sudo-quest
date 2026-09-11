import { useEffect, useState } from "react";
import { scenarios } from "../scenarios";
import type { Scenario } from "../engine/scenario/types";
import {
  createSession,
  execute,
  isCleared,
  revealHint,
  submitCause,
  type Session,
} from "../engine/session/session";
import { calculateScore } from "../engine/session/score";
import { ScenarioList } from "./screens/ScenarioList";
import { TicketScreen } from "./screens/TicketScreen";
import { PlayScreen } from "./screens/PlayScreen";
import { ReportScreen } from "./screens/ReportScreen";
import { clearProgress, loadProgress, saveClear, type Progress } from "./storage";
import "./styles.css";

/**
 * 화면 전환.
 *
 * 라우터를 쓰지 않았다. 화면이 4개뿐이고 URL을 공유할 일이 없어서
 * 상태 하나로 충분하다. (GitHub Pages 하위 경로 문제도 피할 수 있다)
 */
type Screen = "list" | "ticket" | "play" | "report";

export function App() {
  const [screen, setScreen] = useState<Screen>("list");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [progress, setProgress] = useState<Progress>(() => loadProgress());

  // 클리어되는 순간 결과 화면으로 넘기고 진행 상황을 저장한다.
  // 명령어 실행과 원인 제출 양쪽에서 클리어될 수 있어서, 한곳에서 감시한다.
  useEffect(() => {
    if (!session || screen !== "play" || !isCleared(session)) return;
    setProgress(saveClear(session.scenario.id, calculateScore(session).total));
    setScreen("report");
  }, [session, screen]);

  function startScenario(selected: Scenario) {
    setScenario(selected);
    setScreen("ticket");
  }

  function beginInvestigation() {
    if (!scenario) return;
    setSession(createSession(scenario));
    setScreen("play");
  }

  function backToList() {
    setSession(null);
    setScenario(null);
    setScreen("list");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>
          장애 대응 트러블슈팅{" "}
          <span className="muted small" style={{ fontWeight: 400 }}>
            가상 환경 · 실제 시스템에 영향 없음
          </span>
        </h1>
        {screen !== "list" && (
          <button className="small" onClick={backToList}>
            시나리오 목록
          </button>
        )}
      </header>

      {screen === "list" && (
        <ScenarioList
          scenarios={scenarios}
          progress={progress}
          onSelect={startScenario}
          onResetProgress={() => setProgress(clearProgress())}
        />
      )}

      {screen === "ticket" && scenario && (
        <TicketScreen scenario={scenario} onStart={beginInvestigation} onBack={backToList} />
      )}

      {screen === "play" && session && (
        <PlayScreen
          session={session}
          onCommand={(input) => setSession(execute(session, input))}
          onRevealHint={() => setSession(revealHint(session))}
          onSubmitCause={(choiceId) => {
            const result = submitCause(session, choiceId);
            setSession(result.session);
            return { correct: result.correct, whyWrong: result.whyWrong };
          }}
          onGiveUp={backToList}
        />
      )}

      {screen === "report" && session && (
        <ReportScreen session={session} onBackToList={backToList} onRetry={beginInvestigation} />
      )}
    </div>
  );
}
