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

  return (
    <div className="play-layout">
      <Terminal
        state={session.state}
        lines={session.lines}
        available={session.scenario.commands}
        onSubmit={onCommand}
      />

      <Sidebar
        session={session}
        onRevealHint={onRevealHint}
        onOpenCause={() => setCauseOpen(true)}
        onGiveUp={onGiveUp}
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
