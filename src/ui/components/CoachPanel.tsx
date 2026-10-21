import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "../../engine/session/session";
import { buildCoachRequest, type CoachAnswer } from "../../api/coach";
import { getItems, getJob, startCoach, type Item, type Message } from "../../api/knowledge";

type Turn = { question: string; result?: CoachAnswer; error?: string };
const stages: Record<string, string> = {
  queued: "요청 대기 중", search_terms: "관찰 기록에서 검색어 뽑는 중", retrieve: "공식 문서 근거 찾는 중",
  generate: "다음 점검을 정리하는 중", cache: "저장된 코칭 확인 중",
};

/**
 * 실습 중 코치(F2010). 플레이어에게 보이는 정보만 서버로 보낸다(buildCoachRequest 참고).
 * 복구 여부는 게임 엔진이 판정하며, 코치는 판정하지 않는다.
 */
export function CoachPanel({ session }: { session: Session }) {
  // 실습 판마다 새 ID를 쓴다. 시나리오 ID를 쓰면 실습 정체가 드러나므로 무작위 값이다.
  const sessionId = useMemo(() => crypto.randomUUID(), [session.startedAt]);
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [stage, setStage] = useState<string | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => { setTurns([]); setItemId(""); }, [sessionId]);
  useEffect(() => { getItems().then(r => { if (active.current) setItems(r.items); }).catch(() => undefined); }, []);

  async function submit() {
    const text = question.trim();
    if (!text || stage) return;
    const previous = turns;
    const history: Message[] = previous.filter(t => t.result).slice(-3).flatMap(t => [
      { role: "user" as const, content: t.question }, { role: "assistant" as const, content: t.result!.answer },
    ]);
    setQuestion(""); setTurns([...previous, { question: text }]); setStage("queued");
    try {
      const { job_id } = await startCoach(buildCoachRequest(session, sessionId, text, itemId || null, history));
      const deadline = Date.now() + 180000;
      while (active.current && Date.now() < deadline) {
        const job = await getJob<CoachAnswer>(job_id);
        if (!active.current) return;
        if (job.status === "failed") throw new Error(job.message || "코칭에 실패했습니다.");
        if (job.status === "complete" && job.result) { setTurns([...previous, { question: text, result: job.result }]); return; }
        setStage(job.stage);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      throw new Error("응답 대기 시간이 초과되었습니다.");
    } catch (reason) {
      if (active.current) setTurns([...previous, { question: text, error: reason instanceof Error ? reason.message : "연결 오류가 발생했습니다." }]);
    } finally { if (active.current) setStage(null); }
  }

  return <section className="panel coach">
    <h4>코치에게 묻기</h4>
    <p className="small muted">티켓·연 힌트·내가 실행한 명령과 출력만 보냅니다. 정답 정보는 보내지 않으며 복구 판정은 게임이 합니다.</p>
    {turns.map((turn, index) => <article key={index} className="coach-turn">
      <p className="small"><strong>Q.</strong> {turn.question}</p>
      {turn.error && <p role="alert" className="small">{turn.error}</p>}
      {turn.result && <>
        <p className="answer-text small">{turn.result.answer}</p>
        {turn.result.suggested_checks.length > 0 && <ul className="small">{turn.result.suggested_checks.map((c, i) => <li key={i}>{c}</li>)}</ul>}
        {turn.result.warnings.map((w, i) => <p className="muted small" key={i}>{w}</p>)}
        {turn.result.observations.length > 0 && <details><summary className="small">인용한 실습 기록 {turn.result.observations.length}건</summary>
          {turn.result.observations.map(o => <div key={o.observation_id} className="small source-card">
            [실습 기록 {o.observation_id}] <code>{o.command}</code> (종료 코드 {o.exit_code})</div>)}
        </details>}
        {turn.result.citations.length > 0 && <details><summary className="small">공식 문서 근거 {turn.result.citations.length}건</summary>
          {turn.result.citations.map(c => <div key={c.evidence_id} className="small source-card">
            <a href={c.source_url} target="_blank" rel="noreferrer">[근거 {c.evidence_id}] {c.title}</a>
            <div className="muted">{c.source_type === "item_metadata" ? "항목 메타데이터" : "공식 상세 문서"} · {c.publisher} · {c.license}</div>
          </div>)}
        </details>}
      </>}
    </article>)}
    {stage && <p role="status" className="small">{stages[stage] || "처리 중"}</p>}
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label className="small" htmlFor="coach-item">학습 주제 (선택)</label>
      <select id="coach-item" value={itemId} onChange={e => setItemId(e.target.value)}>
        <option value="">자동: 질문과 내 실행 기록으로 찾기</option>
        {items.map(item => <option key={item.item_id} value={item.item_id}>{item.product} · {item.title_ko}</option>)}
      </select>
      <textarea value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} rows={3}
        aria-label="코치에게 할 질문" placeholder="지금까지 본 것으로 다음에 무엇을 확인하면 좋을까요?" />
      <button disabled={!!stage || !question.trim()} style={{ width: "100%" }}>코치에게 묻기</button>
    </form>
  </section>;
}
