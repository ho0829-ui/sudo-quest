import { useEffect, useRef, useState } from "react";
import { getHealth, type Health } from "../../api/health";
import "./backend-status.css";

/** 설정되지 않은 환경변수 이름만 모은다. 값은 서버가 보내지도 않는다. */
function missingNames(health: Health): string[] {
  return [...new Set([...health.providers.generation.missing, ...health.providers.embedding.missing])];
}

type Tone = "checking" | "ok" | "warn" | "off";

function badge(health: Health | null, error: boolean): { tone: Tone; label: string } {
  if (error) return { tone: "off", label: "오프라인" };
  if (!health) return { tone: "checking", label: "확인 중…" };
  if (missingNames(health).length > 0 || health.rag_status !== "pilot_ready") return { tone: "warn", label: "설정 필요" };
  return { tone: "ok", label: "RAG 준비됨" };
}

/**
 * AI 코치 서버 상태. 상단바 오른쪽의 작은 배지이고, 누르면 자세한 상태·다시 확인·설정 안내가 펼쳐진다.
 * 예전에는 모든 화면 위에 한 줄(43px)을 차지했는데, 1280×720에서 본문이 밀려 배지로 줄였다.
 */
export function BackendStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLDetailsElement>(null);
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

  // 펼친 상태에서 바깥을 누르거나 Esc를 누르면 닫는다(details는 스스로 닫히지 않는다).
  useEffect(() => {
    const close = (event: Event) => {
      const box = ref.current;
      if (!box?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.contains(event.target as Node)) box.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);

  const { tone, label } = badge(health, error);
  return (
    <details className={`coach-status tone-${tone}`} ref={ref}>
      <summary aria-live="polite"><span className="coach-status-dot" aria-hidden="true" /><strong>AI 코치</strong><span className="coach-status-label">{label}</span></summary>
      <div className="coach-status-panel">
        <p>
          {error ? "코치 서버에 연결하지 못했어요. 가상 실습은 바로 이용할 수 있어요."
            : !health ? "서버 상태를 확인하는 중이에요."
            : `서버 연결됨 · 생성 ${health.providers.generation.configured ? "설정됨" : "설정 필요"}`
              + ` · 임베딩 ${health.providers.embedding.configured ? "설정됨" : "설정 필요"}`
              + ` · 지식 ${health.index.counts.knowledge_items ?? 0}건`
              + ` · ${health.rag_status === "pilot_ready" ? "지식 RAG 준비됨" : "지식 색인 준비 필요"}`}
        </p>
        {health && missingNames(health).length > 0 && <p role="alert">
          API 설정이 없습니다: {missingNames(health).join(", ")}. <code>backend/.env</code>에 값을 넣고(GMS는 <code>GMS_KEY</code>) 서버를 다시 시작하세요.
          키 값은 화면에 표시하지 않습니다. 이미 저장된 답변만 볼 수 있습니다.
        </p>}
        {health && health.rag_status !== "pilot_ready" && <p role="alert">
          지식 색인이 비어 있거나 설정과 맞지 않습니다. Python 가상환경을 활성화한 뒤 <code>backend</code> 폴더에서{" "}
          <code>python -m scripts.prepare_corpus</code>를 실행한 뒤 다시 확인하세요.
        </p>}
        <button type="button" className="small" onClick={() => setAttempt(attempt + 1)}>다시 확인</button>
      </div>
    </details>
  );
}
