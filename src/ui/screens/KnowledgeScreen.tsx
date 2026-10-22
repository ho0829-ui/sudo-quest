import { TerminalLoader } from "../components/TerminalLoader";
import { useEffect, useRef, useState } from "react";
import { getItems, getJob, startChat, type Item } from "../../api/knowledge";
import { ConditionSearch } from "../components/ConditionSearch";
import { RichAnswer, RichLine } from "../components/RichAnswer";
import { RoomVignette } from "../campus/RoomVignette";
import { ExternalLink } from "../components/ExternalLink";
import { settlePending, useStoredState } from "../useStoredState";

function reviveTurns(value: unknown): Record<string, Turn[]> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const result: Record<string, Turn[]> = {};
  for (const [item, turns] of Object.entries(value)) if (Array.isArray(turns)) result[item] = settlePending(turns as Turn[]);
  return result;
}
import { historyFor, type Turn } from "../chatHistory";

const stages: Record<string, string> = {
  queued: "요청 대기 중", search_terms: "검색어 추출 중", select_documents: "공식 문서 후보 검색·선별 중",
  select_cache: "이전에 선별한 문서 재사용 중", collect: "선별한 문서 수집·색인 중",
  retrieve: "관련 근거 검색 중", generate: "근거 기반 답변 생성·검증 중", cache: "저장된 답변 확인 중",
};

/** 처음 질문하는 사람이 "무엇을 물어야 할지" 막히지 않게 하는 예시. 원인·확인·구분 세 방향이다. */
/** 제품 이름을 CSS 클래스용 이름으로. "AWS ALB" → "aws-alb" */
export function productSlug(product: string): string {
  return product.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

const EXAMPLE_QUESTIONS = [
  "어떤 조건에서 이 오류가 발생하나요?",
  "이 오류가 났을 때 무엇부터 확인해야 하나요?",
  "비슷한 다른 오류와 어떻게 구분하나요?",
];

export function KnowledgeScreen() {
  const [items, setItems] = useState<Item[]>([]);
  const [selected, setSelected] = useStoredState("incident-game/knowledge/selected", () => "", v => (typeof v === "string" ? v : null));
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("");
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useStoredState<Record<string, Turn[]>>("incident-game/knowledge/turns", () => ({}), reviveTurns);
  const [pending, setPending] = useState<{ item: string; stage: string } | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function load() {
    setError("");
    try {
      const result = await getItems();
      if (!active.current) return;
      setItems(result.items); setReady(result.index_ready);
    } catch { if (active.current) setError("지식 목록을 불러오지 못했습니다. 서버 연결을 확인해주세요."); }
  }
  useEffect(() => { void load(); }, []);

  async function submit() {
    const text = question.trim();
    if (!text || !selected || pending) return;
    const item = selected;
    const previous = turns[item] ?? [];
    const history = historyFor(turns, item);
    setQuestion(""); setError("");
    setTurns(current => ({ ...current, [item]: [...previous, { question: text }] }));
    setPending({ item, stage: "queued" });
    try {
      const { job_id } = await startChat(item, text, history);
      const deadline = Date.now() + 240000;
      while (active.current && Date.now() < deadline) {
        const job = await getJob(job_id);
        if (!active.current) return;
        if (job.status === "failed") throw new Error(job.message || "답변 생성에 실패했습니다.");
        if (job.status === "complete" && job.result) {
          setTurns(current => ({ ...current, [item]: [...previous, { question: text, result: job.result }] }));
          return;
        }
        setPending({ item, stage: job.stage });
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      throw new Error("응답 대기 시간이 초과되었습니다. 서버 작업은 계속될 수 있습니다.");
    } catch (reason) {
      if (active.current) setTurns(current => ({ ...current, [item]: [...previous, {
        question: text, error: reason instanceof Error ? reason.message : "연결 오류가 발생했습니다.",
      }] }));
    } finally { if (active.current) setPending(null); }
  }

  const item = items.find(row => row.item_id === selected);
  // 제품별 주제 수(실제 목록에서 센다). 머리 배지에 쓴다.
  const products = [...items.reduce((map, row) => map.set(row.product, (map.get(row.product) ?? 0) + 1), new Map<string, number>())];
  return <section className="knowledge">
    <header className="archive-hero">
      <div>
        <div className="archive-kicker">ARCHIVE · 자료실</div>
        <h2>공식 문서로 배우는 장애 지식</h2>
        <p className="muted">{products.map(([name]) => name).join("·")} {items.length}개 주제 · 공식 문서 근거를 확인하는 학습용 답변입니다. 실제 운영 환경의 진단·복구 판단을 대신하지 않으니, 실서버 조치 전에는 원문 문서와 담당자 절차를 확인하세요.</p>
        <div className="archive-stats">
          {products.map(([name, count]) => <span key={name} className={`product-tag product-${productSlug(name)}`}>{name} <b>{count}</b></span>)}
        </div>
      </div>
      <RoomVignette kind="library" className="archive-room" />
    </header>
    {error && <p role="alert">{error} <button onClick={() => void load()}>다시 불러오기</button></p>}
    {!ready && !error && <p role="status">지식 색인이 준비되지 않아 질문할 수 없습니다. 위 안내대로 색인을 만든 뒤 <button onClick={() => void load()}>다시 확인</button>해주세요.</p>}
    <ConditionSearch ready={ready} onSelect={id => { setSelected(id); setQuestion(""); }} />
    <div className="knowledge-layout">
      <aside>
        <label>항목 이름·제품 검색<input value={filter} onChange={e => setFilter(e.target.value)} placeholder="예: ALB, 인증서" /></label>
        <div className="knowledge-items">
          {items.filter(row => `${row.title_ko} ${row.product}`.toLowerCase().includes(filter.toLowerCase())).map(row =>
            <button key={row.item_id} aria-pressed={selected === row.item_id} onClick={() => { setSelected(row.item_id); setQuestion(""); }}>
              <span className={`product-tag product-${productSlug(row.product)}`}>{row.product}</span><br />{row.title_ko}
            </button>)}
        </div>
      </aside>
      <div>
        {!item ? <p>질문할 지식 항목을 선택해주세요.</p> : <>
          <h3>{item.title_ko}</h3><p>{item.summary}</p>
          <p className="muted small">항목별 대화는 이 화면을 사용하는 동안 보관됩니다. 질문에는 최근 완료된 5회 대화를 함께 전달합니다.</p>
          <div className="knowledge-turns">
            {(turns[selected] ?? []).map((turn, index) => <article key={index}>
              <h4>질문</h4><p className="answer-text">{turn.question}</p>
              {turn.error && <p role="alert">{turn.error}</p>}
              {turn.result && <>
                <h4>문서 기반 답변</h4><RichAnswer text={turn.result.answer} />
                {turn.result.suggested_checks.length > 0 && <ul>{turn.result.suggested_checks.map((check, i) => <li key={i}><RichLine text={check} /></li>)}</ul>}
                {turn.result.warnings.map((warning, i) => <p className="muted" key={i}>{warning}</p>)}
                {turn.result.citations.length > 0 && <details open><summary>답변에 사용한 근거 {turn.result.citations.length}건</summary>
                  {turn.result.citations.map(c => <div className="source-card" key={c.evidence_id}>
                    <ExternalLink href={c.source_url}>[근거 {c.evidence_id}] {c.title}</ExternalLink>
                    <div className="muted small">{c.source_type === "item_metadata" ? "항목 메타데이터" : "공식 상세 문서"} · {c.publisher} · {c.license}</div>
                    <details><summary>검색한 근거 본문 보기</summary><p className="answer-text">{c.text}</p></details>
                  </div>)}
                </details>}
                {(turn.result.collected_documents?.length ?? 0) > 0 && <p className="muted small">이번 질문에서 새로 수집·색인한 공식 문서: {turn.result.collected_documents!.map(d => d.title).join(", ")}</p>}
                {turn.result.cache_hit && <small className="muted">동일 질문·맥락의 검증된 형식 답변을 캐시에서 불러왔습니다.</small>}
              </>}
            </article>)}
          </div>
          {pending && <TerminalLoader label={pending.item === selected ? stages[pending.stage] || "처리 중" : "다른 항목의 답변을 처리 중입니다."} />}
          <form onSubmit={e => { e.preventDefault(); void submit(); }}>
            <label htmlFor="knowledge-question">공식 문서에 질문하기</label>
            {/* 예시는 입력창에 채우기만 한다. 유료 호출이므로 보내기는 사용자가 직접 누른다. */}
            <div className="example-questions" role="group" aria-label="예시 질문">
              {EXAMPLE_QUESTIONS.map(example => <button key={example} type="button"
                onClick={() => { setQuestion(example); document.getElementById("knowledge-question")?.focus(); }}>{example}</button>)}
            </div>
            <textarea id="knowledge-question" value={question} onChange={e => setQuestion(e.target.value)} maxLength={2000} rows={3} placeholder="직접 입력하거나 위 예시를 눌러 고쳐 써 보세요." />
            <button className="primary" disabled={!ready || !!pending || !question.trim()}>근거 찾아 질문하기</button>
          </form>
        </>}
      </div>
    </div>
  </section>;
}
