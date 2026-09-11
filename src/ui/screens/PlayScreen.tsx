import { useState } from "react";
import { Terminal } from "../components/Terminal";
import { Sidebar } from "../components/Sidebar";
import { CauseDialog } from "../components/CauseDialog";
import type { Session } from "../../engine/session/session";

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
          wrongAnswers={session.wrongAnswers}
          onSubmit={onSubmitCause}
          onClose={() => setCauseOpen(false)}
        />
      )}
    </div>
  );
}
