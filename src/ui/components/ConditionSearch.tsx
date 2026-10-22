import { useEffect, useRef, useState } from "react";
import { TerminalLoader } from "./TerminalLoader";
import { getJob, startSearch, type ExploreResult } from "../../api/knowledge";
import { isExploreResult } from "../../api/validate";

const stages: Record<string, string> = {
  queued: "요청 대기 중", candidates: "조건에 가까운 항목 후보 찾는 중",
  judge: "후보가 조건에 맞는지 판정 중", cache: "저장된 탐색 결과 확인 중",
};

/** 자연어 조건으로 지식 항목을 찾는다(F2011). 카드를 누르면 그 항목의 대화로 이동한다. */
export function ConditionSearch({ ready, onSelect }: { ready: boolean; onSelect: (itemId: string) => void }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  const [result, setResult] = useState<ExploreResult | null>(null);
  const [error, setError] = useState("");
  const active = useRef(true);
  // StrictMode는 마운트→해제→마운트를 하므로 마운트할 때마다 다시 true로 둔다.
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  async function submit() {
    const text = query.trim();
    if (!text || stage) return;
    setError(""); setResult(null); setStage("queued");
    try {
      const { job_id } = await startSearch(text);
      const deadline = Date.now() + 120000;
      while (active.current && Date.now() < deadline) {
        const job = await getJob(job_id, isExploreResult);
        if (!active.current) return;
        if (job.status === "failed") throw new Error(job.message || "조건 탐색에 실패했습니다.");
        if (job.status === "complete" && job.result) { setResult(job.result); return; }
        setStage(job.stage);
        await new Promise(resolve => setTimeout(resolve, 700));
      }
      throw new Error("응답 대기 시간이 초과되었습니다.");
    } catch (reason) {
      if (active.current) setError(reason instanceof Error ? reason.message : "연결 오류가 발생했습니다.");
    } finally { if (active.current) setStage(null); }
  }

  const filters = result?.applied_filters;
  return <section className="condition-search">
    <form onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label htmlFor="condition-query">조건으로 항목 찾기</label>
      <input id="condition-query" value={query} onChange={e => setQuery(e.target.value)} maxLength={500}
        placeholder="예: curl에서 인증서 검증과 관련된 오류" />
      <button className="small" disabled={!ready || !!stage || !query.trim()}>조건으로 찾기</button>
    </form>
    {stage && <TerminalLoader label={stages[stage] || "처리 중"} />}
    {error && <p role="alert">{error}</p>}
    {result && <div className="condition-results">
      <p className="muted small">
        후보 {result.candidate_count}건 중 {result.cards.length}건
        {filters && (filters.products.length > 0 || filters.codes.length > 0) &&
          ` · 적용한 필터: ${[...filters.products, ...filters.codes].join(", ")}`}
        {result.cache_hit && " · 저장된 결과"}
      </p>
      {result.cards.map(card => <button key={card.item_id} className="condition-card" onClick={() => onSelect(card.item_id)}>
        <span className="muted small">{card.product} · {card.category}</span><br />
        <strong>{card.title_ko}</strong><br /><span className="small">{card.reason}</span>
      </button>)}
      {result.unverifiable_conditions.length > 0 &&
        <p className="muted small">항목 정보로 확인할 수 없어 판정에 쓰지 않은 조건: {result.unverifiable_conditions.join(", ")}</p>}
      {result.notes.map((note, i) => <p className="muted small" key={i}>{note}</p>)}
    </div>}
  </section>;
}
