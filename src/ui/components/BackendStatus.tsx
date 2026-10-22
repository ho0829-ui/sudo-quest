import { useEffect, useState } from "react";
import { TerminalLoader } from "./TerminalLoader";
import { getHealth, type Health } from "../../api/health";

/** 설정되지 않은 환경변수 이름만 모은다. 값은 서버가 보내지도 않는다. */
function missingNames(health: Health): string[] {
  return [...new Set([...health.providers.generation.missing, ...health.providers.embedding.missing])];
}

export function BackendStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setHealth(null);
    setError(false);
    const timeout = setTimeout(() => controller.abort(), 5000);
    getHealth(controller.signal)
      .then((data) => { if (active) setHealth(data); })
      .catch(() => { if (active) setError(true); })
      .finally(() => clearTimeout(timeout));
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [attempt]);

  return (
    <aside className="backend-status" aria-live="polite">
      <strong>AI COACH</strong>{" · "}
      {error ? "코치 오프라인 · 가상 실습은 바로 이용할 수 있어요."
        : !health ? <TerminalLoader compact label="서버 확인 중…" />
        : `서버 연결됨 · 생성 ${health.providers.generation.configured ? "설정됨" : "설정 필요"}`
          + ` · 임베딩 ${health.providers.embedding.configured ? "설정됨" : "설정 필요"}`
          + ` · 지식 ${health.index.counts.knowledge_items ?? 0}건`}
      {health && <span> · {health.rag_status === "pilot_ready" ? "지식 RAG 준비됨" : "지식 색인 준비 필요"}</span>}
      <button className="small" onClick={() => setAttempt(attempt + 1)}>다시 확인</button>
      {health && missingNames(health).length > 0 && <p role="alert" className="small">
        API 설정이 없습니다: {missingNames(health).join(", ")}. <code>backend/.env</code>에 값을 넣고(GMS는 <code>GMS_KEY</code>) 서버를 다시 시작하세요.
        키 값은 화면에 표시하지 않습니다. 이미 저장된 답변만 볼 수 있습니다.
      </p>}
      {health && health.rag_status !== "pilot_ready" && <p role="alert" className="small">
        지식 색인이 비어 있거나 설정과 맞지 않습니다. Python 가상환경을 활성화한 뒤 <code>backend</code> 폴더에서{" "}
        <code>python -m scripts.prepare_corpus</code>를 실행한 뒤 다시 확인하세요.
      </p>}
    </aside>
  );
}
