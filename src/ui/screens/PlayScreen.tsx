import { useState, type CSSProperties } from "react";
import { Terminal } from "../components/Terminal";
import { Sidebar } from "../components/Sidebar";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { CauseDialog } from "../components/CauseDialog";
import type { Session } from "../../engine/session/session";
import { execute } from "../../engine/session/execute";
import { shuffleChoices } from "../shuffleChoices";
import { MissionHud } from "../components/MissionHud";
import { THEMES } from "../campus/themes";
import { scenarios } from "../../scenarios";

interface PlayScreenProps {
  session: Session;
  /** 세션을 바꾸는 함수를 넘긴다. 명령 실행(execute)은 이 화면 조각 안에 있어 App이 명령 구현을 가져오지 않는다. */
  onUpdate: (change: (current: Session) => Session) => void;
  onRevealHint: () => void;
  onSubmitCause: (choiceId: string) => { correct: boolean; whyWrong?: string };
  onGiveUp: () => void;
}

export function PlayScreen({
  session,
  onUpdate,
  onRevealHint,
  onSubmitCause,
  onGiveUp,
}: PlayScreenProps) {
  const onCommand = (input: string) => onUpdate((current) => execute(current, input));
  const [causeOpen, setCauseOpen] = useState(false);
  // 모달을 다시 열거나 오답을 고르더라도 한 판 안에서는 순서를 유지한다.
  const [choices] = useState(() => shuffleChoices(session.scenario.rootCause.choices));
  // 코치가 제안한 명령을 터미널 입력줄에 넣는다. 같은 명령을 다시 눌러도 반영되도록 번호를 붙인다.
  const [draft, setDraft] = useState({ text: "", nonce: 0 });

  return (
    <>
    <MissionHud session={session} missionNo={scenarios.indexOf(session.scenario) + 1} />
    <div className="play-layout" style={{ "--room": THEMES[session.scenario.category].accent } as CSSProperties}>
      <div className="terminal-window">
      <div className="terminal-toolbar"><span className="window-dots"><i /><i /><i /></span><span>{session.state.user}@{session.state.hostname} — bash</span><span className="terminal-live"><i /> LIVE · SIMULATED</span></div>
      <Terminal
        state={session.state}
        lines={session.lines}
        available={session.scenario.commands}
        draft={draft}
        onSubmit={onCommand}
      />
      <div className="terminal-help">↑ ↓ 명령 기록 · Tab 자동완성 · Shift+Tab 포커스 이동 · help 명령어 안내</div>
      </div>

      {/* 코치·힌트 패널에서 오류가 나도 터미널은 계속 쓸 수 있게 따로 막는다. */}
      <ErrorBoundary label="코치·힌트 패널" compact>
      <Sidebar
        session={session}
        onRevealHint={onRevealHint}
        onOpenCause={() => setCauseOpen(true)}
        onGiveUp={onGiveUp}
        onUseCommand={text => setDraft(current => ({ text, nonce: current.nonce + 1 }))}
      />
      </ErrorBoundary>

      {causeOpen && (
        <CauseDialog
          scenario={session.scenario}
          choices={choices}
          wrongAnswers={session.wrongAnswers}
          onSubmit={onSubmitCause}
          onClose={() => setCauseOpen(false)}
        />
      )}
    </div>
    </>
  );
}
