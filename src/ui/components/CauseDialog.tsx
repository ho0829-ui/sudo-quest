import { useState } from "react";
import type { Scenario } from "../../engine/scenario/types";

interface CauseDialogProps {
  scenario: Scenario;
  /** 이미 틀린 적 있는 보기 id */
  wrongAnswers: string[];
  onSubmit: (choiceId: string) => { correct: boolean; whyWrong?: string };
  onClose: () => void;
}

export function CauseDialog({ scenario, wrongAnswers, onSubmit, onClose }: CauseDialogProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  function handleChoice(choiceId: string) {
    const result = onSubmit(choiceId);
    if (result.correct) {
      onClose();
      return;
    }
    // 틀리면 왜 아닌지 알려주고 계속 조사하게 둔다
    setFeedback(result.whyWrong ?? "이건 원인이 아닙니다. 다시 확인해 보세요.");
  }

  return (
    <div className="dialog-backdrop" onClick={onClose} role="presentation">
      <div className="dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
        <h2 style={{ marginTop: 0, fontSize: 18 }}>이 장애의 원인은 무엇인가요?</h2>
        <p className="small muted">틀려도 계속 조사할 수 있습니다. 다만 오답 1회당 80점이 깎입니다.</p>

        {feedback && (
          <div className="feedback">
            <strong className="small">그 원인은 아닙니다</strong>
            <div className="small">{feedback}</div>
          </div>
        )}

        {scenario.rootCause.choices.map((choice) => {
          const alreadyWrong = wrongAnswers.includes(choice.id);
          return (
            <button
              key={choice.id}
              className={`choice${alreadyWrong ? " wrong" : ""}`}
              onClick={() => handleChoice(choice.id)}
              disabled={alreadyWrong}
            >
              {choice.label}
              {alreadyWrong && <span className="small muted"> — 이미 틀린 보기</span>}
            </button>
          );
        })}

        <div className="row end" style={{ marginTop: 14 }}>
          <button onClick={onClose}>더 조사하기</button>
        </div>
      </div>
    </div>
  );
}
