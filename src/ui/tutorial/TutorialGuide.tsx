/**
 * 튜토리얼 코치 마크: 지금 단계의 화면 요소를 밝히고(나머지는 어둡게) 그 근처에 말풍선을 띄운다.
 * 밝힌 칸과 어두운 막은 클릭을 막지 않는다(pointer-events: none) — 플레이어는 평소처럼 터미널을 쓰고 버튼을 누른다.
 * 대화창(퀘스트 브리핑·원인 제출)은 브라우저 최상위 층에 뜨므로 이 막 위에 그대로 보인다.
 */
import { useEffect, useState, type CSSProperties } from "react";
import type { Session } from "../../engine/session/session";
import { currentStep, TUTORIAL_STEPS, type TutorialStage } from "./steps";
import "./tutorial.css";

interface TutorialGuideProps {
  stage: TutorialStage;
  session: Session | null;
  motion: boolean;
  /** 건너뛰기(Esc). 튜토리얼 실습은 그대로 계속할 수 있다. */
  onSkip: () => void;
  /** 마지막 말풍선까지 봤다 */
  onFinish: () => void;
}

interface Box { top: number; left: number; width: number; height: number }

const BUBBLE_W = 340;
const BUBBLE_H = 210;
const GAP = 14;

/** 대상 요소의 화면 위치를 따라간다. 레이아웃이 바뀌는 순간(출력이 늘어남 등)도 잡으려고 짧게 다시 잰다. */
function useTargetBox(selector: string | undefined): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  useEffect(() => {
    if (!selector) { setBox(null); return; }
    const measure = () => {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      const next = r && r.width > 0 ? { top: r.top, left: r.left, width: r.width, height: r.height } : null;
      setBox(prev => (prev && next && prev.top === next.top && prev.left === next.left && prev.width === next.width && prev.height === next.height) ? prev : next);
    };
    measure();
    const timer = window.setInterval(measure, 250);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { window.clearInterval(timer); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [selector]);
  return box;
}

/**
 * 말풍선 자리: 대상 위 → 아래 → 왼쪽 → 오른쪽 → 화면 오른쪽 아래 구석. 대상을 가리지 않는 첫 자리를 고른다.
 * 좁은 화면은 CSS가 화면 아래에 붙인다.
 */
function bubbleStyle(box: Box | null): CSSProperties {
  const vw = window.innerWidth, vh = window.innerHeight;
  if (!box) return { right: 16, bottom: 16 };
  const left = Math.min(Math.max(16, box.left), vw - BUBBLE_W - 16);
  const top = Math.min(Math.max(16, box.top), vh - BUBBLE_H - 16);
  if (box.top - GAP - BUBBLE_H >= 8) return { left, top: box.top - GAP - BUBBLE_H };
  if (box.top + box.height + GAP + BUBBLE_H <= vh - 8) return { left, top: box.top + box.height + GAP };
  if (box.left - GAP - BUBBLE_W >= 16) return { left: box.left - GAP - BUBBLE_W, top };
  if (box.left + box.width + GAP + BUBBLE_W <= vw - 16) return { left: box.left + box.width + GAP, top };
  return { right: 16, bottom: 16 };
}

/**
 * 좁은 화면은 말풍선을 화면 아래에 붙인다. 다만 대상이 화면 아래쪽까지 길게 차지하면(터미널 — 입력줄이 아래에 있다)
 * 아래 말풍선이 입력줄을 가리므로 위에 붙인다.
 */
function dockTop(box: Box | null): boolean {
  if (!box || window.innerWidth > 520) return false;
  const vh = window.innerHeight;
  return box.top < vh * 0.4 && box.top + box.height > vh * 0.6;
}

export function TutorialGuide({ stage, session, motion, onSkip, onFinish }: TutorialGuideProps) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());
  const step = currentStep(stage, session, acknowledged);
  const box = useTargetBox(step?.target);

  // 단계가 바뀌면 대상이 보이게 스크롤한다(화면 밖이면 말풍선이 무엇을 가리키는지 모른다).
  // 화면이 바뀔 때 App이 맨 위로 올리므로(자식 효과가 먼저 돈다) 한 박자 늦게 움직인다.
  useEffect(() => {
    if (!step) return;
    const timer = window.setTimeout(() => {
      document.querySelector(step.target)?.scrollIntoView({ block: "nearest", behavior: motion ? "smooth" : "auto" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [step?.id]);

  // Esc는 건너뛰기. 단, 대화창이 열려 있으면 그 대화창을 닫는 Esc이므로 건드리지 않는다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) onSkip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSkip]);

  if (!step) return null;
  const index = TUTORIAL_STEPS.indexOf(step);
  const last = index === TUTORIAL_STEPS.length - 1;
  const acknowledge = () => {
    setAcknowledged(prev => new Set(prev).add(step.id));
    if (last) onFinish();
  };

  return <div className={`tutorial-layer${motion ? "" : " is-still"}`}>
    {box && <div className="tutorial-spot" aria-hidden="true"
      style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }} />}
    <section className={`tutorial-bubble${dockTop(box) ? " dock-top" : ""}`} style={bubbleStyle(box)} role="region" aria-label="튜토리얼 안내" aria-live="polite">
      <span className="tutorial-count">튜토리얼 {index + 1} / {TUTORIAL_STEPS.length}</span>
      <h3>{step.title}</h3>
      <p>{step.body}</p>
      {step.command && <p className="tutorial-command">입력해 보세요 <code>{step.command}</code></p>}
      <div className="tutorial-actions">
        <button type="button" className="tutorial-skip" onClick={onSkip}>건너뛰기 <kbd>Esc</kbd></button>
        {step.done
          ? <span className="tutorial-waiting">직접 해 보면 다음으로 넘어가요</span>
          : <button type="button" className="primary" onClick={acknowledge}>{last ? "튜토리얼 끝내기" : "다음"}</button>}
      </div>
    </section>
  </div>;
}
