import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { QuestOfficer } from './QuestOfficer';
import { questDialogue } from './dialogue';
import { TerminalLoader } from '../components/TerminalLoader';
import { NPCS, type QuestDomain } from './cast';
import { ENTRANCE_LABELS, type QuestPresentation } from './presentation';
import { QuestBackdrop, BACKDROP_NAMES } from './QuestBackdrop';
import './quest.css';
import './cinematics.css';

interface QuestBriefingProps {
  title: string; ticket: string; room: string; accent: string; mission: string;
  domain?: QuestDomain; presentation?: QuestPresentation; onReplay?: () => void;
  motion: boolean; onAccept: () => void; onClose: () => void;
}

export function QuestBriefing({ title, ticket, room, accent, mission, motion, onAccept, onClose, domain = 'aws', presentation, onReplay }: QuestBriefingProps) {
  const [ready, setReady] = useState(!motion);
  const npc = NPCS[presentation?.npc ?? 'doyun'];
  const entrance = presentation?.entrance ?? 'push';
  const [showClue, setShowClue] = useState(false);
  const [step, setStep] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const accepted = useRef(false);
  const pages = questDialogue(title, ticket);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog?.close(); document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!motion || preference.matches) { setReady(true); return; }
    const reduce = () => { if (preference.matches) setReady(true); };
    preference.addEventListener('change', reduce);
    const timer = setTimeout(() => setReady(true), 1600);
    return () => { clearTimeout(timer); preference.removeEventListener('change', reduce); };
  }, [motion]);
  useEffect(() => { if (ready) headingRef.current?.focus(); }, [ready, step]);
  function accept() {
    if (accepted.current) return;
    accepted.current = true;
    onAccept();
  }
  return <dialog ref={dialogRef} className={`quest-dialog${ready ? ' is-ready' : ''}${!motion ? ' no-motion' : ''}`}
    style={{ '--quest-accent': accent } as CSSProperties} data-domain={domain} data-entrance={entrance} aria-label={`퀘스트 대화 · ${npc.name}`}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const stops = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]'));
      const first = stops[0], last = stops.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onCancel={e => { e.preventDefault(); onClose(); }}>
    <header className="quest-topline"><span><i /> INCOMING QUEST <b>#{mission}</b></span><button type="button" onClick={onClose} aria-label="퀘스트 대화 닫기">닫기 <span>ESC</span></button></header>
    <div className="quest-scene">
      <QuestBackdrop domain={domain} />
      <div className="quest-scene-caption"><span>ON-CALL / {BACKDROP_NAMES[domain]}</span><span>{ENTRANCE_LABELS[entrance]}</span></div>
      <div className="quest-actor"><QuestOfficer npc={npc} /></div>
      <div className="quest-letterbox top" /><div className="quest-letterbox bottom" />
      <div className="quest-scene-label" aria-hidden="true"><span>{room}</span><strong>{npc.callSign}</strong><small>{npc.clue}</small></div>
      {ready && onReplay && <button className="quest-replay" onClick={onReplay}>다른 장면 보기 ↻</button>}
      {!ready && <button className="quest-skip" onClick={() => setReady(true)}>연출 건너뛰기 →</button>}
    </div>
    <section className="quest-conversation">
      <div className="quest-speaker"><span className="quest-speaker-mark">{npc.mark}</span><div><button className="quest-name" aria-expanded={showClue} aria-controls="quest-clue" onClick={() => setShowClue(v => !v)} aria-label={`${npc.name}의 작은 단서`}>{npc.name} <span>✧</span></button><span>{npc.role}</span></div><span className="quest-dialogue-count">{ready ? `0${step + 1} / 02` : 'CONNECTING'}</span></div>
      {showClue && <p id="quest-clue" className="quest-clue">{npc.homage}{npc.id !== 'doyun' && <small>인물에게 보내는 게임 속 오마주 · 대사는 창작입니다.</small>}</p>}
      {!ready ? <div className="quest-wait"><TerminalLoader label="담당자가 다가오고 있어요…" /></div> : <>
        <div className="quest-lines" key={step} role="region" aria-label="담당자 설명" tabIndex={0}><h2 id="quest-dialog-title" ref={headingRef} tabIndex={-1}>{pages[step].heading}</h2><p>{pages[step].text}</p></div>
        <div className="quest-actions"><button onClick={step ? () => setStep(0) : onClose}>{step ? '← 상황 다시 듣기' : '잠시만요'}</button>
          {step === 0 ? <button className="primary" onClick={() => setStep(1)}>상황 확인했어요 →</button>
            : <button className="primary quest-accept" onClick={accept}>퀘스트 수락 · 조사 시작 <span>↵</span></button>}</div>
      </>}
    </section>
  </dialog>;
}
