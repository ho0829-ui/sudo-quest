import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../../engine/scenario/types';

interface CauseDialogProps {
  scenario: Scenario;
  choices: Scenario['rootCause']['choices'];
  wrongAnswers: string[];
  onSubmit: (choiceId: string) => { correct: boolean; whyWrong?: string };
  onClose: () => void;
}

export function CauseDialog({ choices, wrongAnswers, onSubmit, onClose }: CauseDialogProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement) previous.focus(); };
  }, []);

  function handleChoice(choiceId: string) {
    const result = onSubmit(choiceId);
    if (result.correct) { onClose(); return; }
    setFeedback(result.whyWrong ?? '이건 원인이 아닙니다. 다시 확인해 보세요.');
  }

  return <dialog ref={dialogRef} className="dialog" aria-labelledby="cause-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <h2 id="cause-title" style={{ marginTop: 0, fontSize: 18 }}>이 장애의 원인은 무엇인가요?</h2>
    <p className="small muted">틀려도 계속 조사할 수 있습니다. 다만 오답 1회당 80점이 깎입니다.</p>
    {feedback && <div className="feedback" role="status"><strong className="small">그 원인은 아닙니다</strong><div className="small">{feedback}</div></div>}
    {choices.map(choice => {
      const alreadyWrong = wrongAnswers.includes(choice.id);
      return <button key={choice.id} className={`choice${alreadyWrong ? ' wrong' : ''}`} onClick={() => handleChoice(choice.id)} disabled={alreadyWrong}>
        {choice.label}{alreadyWrong && <span className="small muted"> — 이미 틀린 보기</span>}
      </button>;
    })}
    <div className="row end" style={{ marginTop: 14 }}><button autoFocus onClick={onClose}>더 조사하기</button></div>
  </dialog>;
}
