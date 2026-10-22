import { useEffect, useRef, useState } from "react";
import type { Session } from "../../engine/session/session";
import { DEFAULT_COMMANDS } from "../../engine/commands";
import { buildCoachRequest } from "../../api/coach";
import { getHealth } from "../../api/health";
import { getItems, getJob, startCoach, type Item, type Message } from "../../api/knowledge";
import { isCoachAnswer } from "../../api/validate";
import { coachNudge, quickPrompts, type QuickPrompt } from "../coachPrompts";
import { CoachTurn, type Turn } from "./CoachTurn";
import { sanitizeTurns, settlePending, useStoredState } from "../useStoredState";
import { randomId } from "../randomId";

function reviveCoach(value: unknown): { sessionId: string; turns: Turn[] } | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as { sessionId?: unknown; turns?: unknown };
  const turns = sanitizeTurns(v.turns, isCoachAnswer);
  if (typeof v.sessionId !== "string" || !turns) return null;
  return { sessionId: v.sessionId, turns: settlePending(turns) };
}

const stages: Record<string, string> = {
  queued: "요청 대기 중", search_terms: "관찰 기록에서 검색어 뽑는 중", retrieve: "공식 문서 근거 찾는 중",
  generate: "다음 점검을 정리하는 중", cache: "저장된 코칭 확인 중",
};
type Link = "checking" | "offline" | "setup" | "ready";
const linkText: Record<Link, string> = {
  checking: "연결 확인 중", offline: "오프라인", setup: "설정 필요", ready: "온라인",
};

interface CoachPanelProps {
  session: Session;
  onUseCommand: (command: string) => void;
  /** 답변이 도착했을 때. 다른 탭을 보고 있으면 새 답변 표시를 켠다. */
  onAnswer: () => void;
}

/**
 * 실습 중 코치(F2010). 플레이어에게 보이는 정보만 서버로 보낸다(buildCoachRequest 참고).
 * 복구 여부는 게임 엔진이 판정하며, 코치는 판정하지 않는다.
 */
export function CoachPanel({ session, onUseCommand, onAnswer }: CoachPanelProps) {
  // 실습 판마다 새 ID를 쓴다. 시나리오 ID를 쓰면 실습 정체가 드러나므로 무작위 값이다.
  // 대화와 함께 탭 저장소에 두어, 근거 링크로 페이지를 떠났다 돌아와도 같은 대화가 이어진다.
  const [coach, setCoach] = useStoredState(`incident-game/coach/${session.startedAt}`,
    () => ({ sessionId: randomId(), turns: [] as Turn[] }), reviveCoach);
  const sessionId = coach.sessionId;
  const turns = coach.turns;
  const setTurns = (next: Turn[]) => setCoach((current) => ({ ...current, turns: next }));
  const available = session.scenario.commands ?? DEFAULT_COMMANDS;
  const [link, setLink] = useState<Link>("checking");
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState("");
  const [question, setQuestion] = useState("");
  const [stage, setStage] = useState<string | null>(null);
  // 마지막으로 물어본 시점의 오답·명령 수. 그 뒤의 변화만 보고 코치를 권한다.
  const [askedAt, setAskedAt] = useState({ wrong: 0, commands: 0 });
  const active = useRef(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => { setItemId(""); setAskedAt({ wrong: 0, commands: 0 }); }, [sessionId]);
  useEffect(() => {
    setLink("checking");
    getHealth(AbortSignal.timeout(5000)).then(health => {
      if (!active.current) return;
      const configured = health.providers.generation.configured && health.providers.embedding.configured;
      setLink(configured && health.rag_status === "pilot_ready" ? "ready" : "setup");
      getItems().then(r => { if (active.current) setItems(r.items); }).catch(() => undefined);
    }).catch(() => { if (active.current) setLink("offline"); });
  }, [attempt]);
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const prompts = quickPrompts(session);
  const nudge = stage ? null : coachNudge(session.wrongAnswers.length - askedAt.wrong, session.commands.length - askedAt.commands);
  const canAsk = link !== "offline" && link !== "checking" && !stage;

  async function submit(raw: string) {
    const text = raw.trim();
    if (!text || !canAsk) return;
    const previous = turns;
    const history: Message[] = previous.filter(t => t.result).slice(-3).flatMap(t => [
      { role: "user" as const, content: t.question }, { role: "assistant" as const, content: t.result!.answer },
    ]);
    setQuestion(""); setTurns([...previous, { question: text }]); setStage("queued");
    setAskedAt({ wrong: session.wrongAnswers.length, commands: session.commands.length });
    try {
      const { job_id } = await startCoach(buildCoachRequest(session, sessionId, text, itemId || null, history));
      const deadline = Date.now() + 180000;
      while (active.current && Date.now() < deadline) {
        const job = await getJob(job_id, isCoachAnswer);
        if (!active.current) return;
        if (job.status === "failed") throw new Error(job.message || "코칭에 실패했습니다.");
        if (job.status === "complete" && job.result) {
          setTurns([...previous, { question: text, result: job.result }]); onAnswer(); return;
        }
        setStage(job.stage);
        await new Promise(resolve => setTimeout(resolve, 800));
      }
      throw new Error("응답 대기 시간이 초과되었습니다.");
    } catch (reason) {
      if (active.current) setTurns([...previous, { question: text, error: reason instanceof Error ? reason.message : "연결 오류가 발생했습니다." }]);
    } finally { if (active.current) setStage(null); }
  }

  function askPrompt(prompt: QuickPrompt) {
    if (!prompt.draft) { void submit(prompt.question); return; }
    setQuestion(prompt.question);
    // "내 가설: " 바로 뒤에 커서를 두어 가설만 적으면 되게 한다.
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(6, 6); });
  }

  return <section className="panel coach" aria-label="AI 코치">
    <header className="coach-head">
      <div><h4>AI 코치</h4><p>내가 본 출력만으로 함께 추론합니다</p></div>
      <span className={`coach-link ${link}`}><i />{linkText[link]}</span>
    </header>
    {link === "offline" && <p className="coach-notice">코치 서버에 연결할 수 없어요. 실습은 계속할 수 있습니다.{" "}
      <button type="button" className="text-button" onClick={() => setAttempt(attempt + 1)}>다시 연결</button></p>}
    {link === "setup" && <p className="coach-notice">API 키나 지식 색인이 준비되지 않았어요. 저장된 답변만 받을 수 있습니다.</p>}

    <div className="coach-thread" ref={threadRef} aria-live="polite">
      {turns.length === 0 && <p className="coach-empty">막히면 아래 버튼으로 바로 물어보세요. 정답은 알려주지 않고, 확인된 사실·가설·다음 점검을 나눠 줍니다.</p>}
      {turns.map((turn, index) => <CoachTurn key={index} turn={turn} available={available} onUseCommand={onUseCommand} />)}
      {stage && <p role="status" className="coach-stage">{stages[stage] || "처리 중"}</p>}
    </div>

    {nudge && turns.length < 20 && <button type="button" className="coach-nudge" disabled={!canAsk}
      onClick={() => askPrompt(prompts.find(p => p.id === nudge.promptId)!)}>
      <span>{nudge.message}</span><strong>코치와 정리하기 →</strong>
    </button>}

    <div className="coach-chips" role="group" aria-label="빠른 질문">
      {prompts.map(prompt => <button key={prompt.id} type="button" disabled={!canAsk || prompt.disabled}
        onClick={() => askPrompt(prompt)}>{prompt.label}</button>)}
    </div>

    <form onSubmit={e => { e.preventDefault(); void submit(question); }}>
      <textarea ref={inputRef} value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} rows={3}
        aria-label="코치에게 할 질문" placeholder="예: 로그의 이 오류가 무슨 뜻인가요?"
        onKeyDown={e => {
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void submit(question); }
        }} />
      <div className="coach-submit">
        <span className="muted">⌘/Ctrl + Enter</span>
        <button className="primary" disabled={!canAsk || !question.trim()}>묻기</button>
      </div>
      <details className="coach-topic">
        <summary>학습 주제 지정 (선택)</summary>
        <select id="coach-item" aria-label="학습 주제" value={itemId} onChange={e => setItemId(e.target.value)}>
          <option value="">자동: 질문과 내 실행 기록으로 찾기</option>
          {items.map(item => <option key={item.item_id} value={item.item_id}>{item.product} · {item.title_ko}</option>)}
        </select>
      </details>
    </form>
    <p className="coach-privacy">티켓·연 힌트·내가 실행한 명령과 출력만 보냅니다. 정답 정보는 보내지 않으며 복구 판정은 게임이 합니다.</p>
  </section>;
}
