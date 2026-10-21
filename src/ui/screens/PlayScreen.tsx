import { useState } from "react";
import { Terminal } from "../components/Terminal";
import { Sidebar } from "../components/Sidebar";
import { CauseDialog } from "../components/CauseDialog";
import type { Session } from "../../engine/session/session";
import { shuffleChoices } from "../shuffleChoices";

interface PlayScreenProps {
  session: Session;
  onCommand: (input: string) => void;
  onRevealHint: () => void;
  onSubmitCause: (choiceId: string) => { correct: boolean; whyWrong?: string };
  onGiveUp: () => void;
}

export function PlayScreen({
  session,
  onCommand,
  onRevealHint,
  onSubmitCause,
  onGiveUp,
}: PlayScreenProps) {
  const [causeOpen, setCauseOpen] = useState(false);
  // 모달을 다시 열거나 오답을 고르더라도 한 판 안에서는 순서를 유지한다.
  const [choices] = useState(() => shuffleChoices(session.scenario.rootCause.choices));
  // 코치가 제안한 명령을 터미널 입력줄에 넣는다. 같은 명령을 다시 눌러도 반영되도록 번호를 붙인다.
  const [draft, setDraft] = useState({ text: "", nonce: 0 });

  return (
    <div className="play-layout">
      <Terminal
        state={session.state}
        lines={session.lines}
        available={session.scenario.commands}
        draft={draft}
        onSubmit={onCommand}
      />

      <Sidebar
        session={session}
        onRevealHint={onRevealHint}
        onOpenCause={() => setCauseOpen(true)}
        onGiveUp={onGiveUp}
        onUseCommand={text => setDraft(current => ({ text, nonce: current.nonce + 1 }))}
      />

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
  );
}
