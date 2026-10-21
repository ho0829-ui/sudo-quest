import type { CoachAnswer } from "../../api/coach";
import { runnableCommands } from "../coachPrompts";
import { RichAnswer, RichLine } from "./RichAnswer";

export type Turn = { question: string; result?: CoachAnswer; error?: string };

interface CoachTurnProps {
  turn: Turn;
  available: string[];
  onUseCommand: (command: string) => void;
}

/** 코치 답변 한 턴. 제안 명령은 "터미널에 입력"만 하고 실행은 플레이어에게 맡긴다. */
export function CoachTurn({ turn, available, onUseCommand }: CoachTurnProps) {
  const { result } = turn;
  return <article className="coach-turn">
    <p className="coach-question"><span>YOU</span>{turn.question}</p>
    {turn.error && <p role="alert" className="coach-error">{turn.error}</p>}
    {!turn.error && !result && <p className="coach-pending" aria-hidden="true"><i /><i /><i /></p>}
    {result && <div className="coach-answer">
      <span className="coach-label">COACH</span>
      <RichAnswer text={result.answer} />
      {result.suggested_checks.length > 0 && <div className="coach-checks">
        <strong>다음 점검</strong>
        <ul>{result.suggested_checks.map((check, index) => <li key={index}>
          <span><RichLine text={check} /></span>
          {runnableCommands(check, available).map(command => <button key={command} type="button" className="use-command"
            onClick={() => onUseCommand(command)} aria-label={`${command} 명령을 터미널 입력줄에 넣기`}>
            <code>{command}</code><span>터미널에 입력 ↵</span>
          </button>)}
        </li>)}</ul>
      </div>}
      {result.warnings.map((warning, index) => <p className="muted small" key={index}>{warning}</p>)}
      {result.observations.length > 0 && <details><summary className="small">인용한 실습 기록 {result.observations.length}건</summary>
        {result.observations.map(o => <div key={o.observation_id} className="small source-card">
          [실습 기록 {o.observation_id}] <code>{o.command}</code> (종료 코드 {o.exit_code})</div>)}
      </details>}
      {result.citations.length > 0 && <details><summary className="small">공식 문서 근거 {result.citations.length}건</summary>
        {result.citations.map(c => <div key={c.evidence_id} className="small source-card">
          <a href={c.source_url} target="_blank" rel="noreferrer">[근거 {c.evidence_id}] {c.title}</a>
          <div className="muted">{c.source_type === "item_metadata" ? "항목 메타데이터" : "공식 상세 문서"} · {c.publisher} · {c.license}</div>
        </div>)}
      </details>}
    </div>}
  </article>;
}
