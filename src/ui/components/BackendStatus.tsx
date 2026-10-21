import { useEffect, useState } from "react";
import { getHealth, type Health } from "../../api/health";

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
      <strong>InfraCoach 코치 준비 상태</strong>{" · "}
      {error ? "코치 서버에 연결할 수 없습니다. 가상 실습은 계속 이용할 수 있습니다."
        : !health ? "서버 확인 중…"
        : `서버 연결됨 · 생성 ${health.providers.generation.configured ? "설정됨" : "설정 필요"}`
          + ` · 임베딩 ${health.providers.embedding.configured ? "설정됨" : "설정 필요"}`
          + ` · 지식 ${health.index.counts.knowledge_items ?? 0}건`}
      {health && <span> · RAG 코칭 구현 준비 중 (모델 연결 검증은 별도)</span>}
      <button className="small" onClick={() => setAttempt(attempt + 1)}>다시 확인</button>
    </aside>
  );
}
