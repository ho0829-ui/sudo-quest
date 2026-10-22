import { useEffect, useState, type RefObject } from "react";

/** 저절로 흐르는 속도(px/초)와 빨리 감기 배수. */
export const BASE_SPEED = 42;
export const SPEEDS = [1, 2, 4, 8] as const;

/** 지금 배수 다음 배수. 끝(8배)에서 다시 1배로 돈다. */
export function nextSpeed(speed: number): number {
  const i = SPEEDS.indexOf(speed as (typeof SPEEDS)[number]);
  return SPEEDS[(i + 1) % SPEEDS.length];
}

/**
 * 크레딧 흐름 제어: 저절로 흐르기(일시정지·빨리 감기), 위치 막대로 옮기기, 키보드 스크롤.
 * 사용자가 휠·막대·키로 직접 옮겨도 자동 흐름은 그 자리에서 이어진다(scrollTop에 더하기만 하므로).
 */
export function useCreditRoll(scroller: RefObject<HTMLDivElement | null>, motion: boolean) {
  const [rolling, setRolling] = useState(motion);
  const [speed, setSpeed] = useState<number>(1);
  const [progress, setProgress] = useState(0); // 0~1000
  const ended = progress >= 999;

  useEffect(() => {
    const el = scroller.current;
    if (!el || !rolling) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      el.scrollTop += BASE_SPEED * speed * Math.min(0.05, (now - last) / 1000);
      last = now;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) { setRolling(false); return; }
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [rolling, speed]);

  // 위치 막대는 실제 스크롤 위치를 따라간다(휠로 내려도 막대가 같이 움직인다).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onScroll = () => {
      const max = el.scrollHeight - el.clientHeight;
      setProgress(max > 0 ? Math.round((el.scrollTop / max) * 1000) : 0);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  function seek(value: number) {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = (value / 1000) * (el.scrollHeight - el.clientHeight);
  }
  function scrollBy(pixels: number) { scroller.current?.scrollBy({ top: pixels }); }
  function toggle() {
    if (ended) { seek(0); setRolling(true); return; }
    setRolling(r => !r);
  }

  // ↑↓ PageUp/PageDown Home/End로 옮기고, Space로 멈추고 이어 본다. 버튼·막대에 포커스가 있을 때는 그쪽 동작을 따른다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "INPUT") return;
      const page = (scroller.current?.clientHeight ?? 600) * 0.8;
      const moves: Record<string, () => void> = {
        ArrowDown: () => scrollBy(80), ArrowUp: () => scrollBy(-80), PageDown: () => scrollBy(page), PageUp: () => scrollBy(-page),
        Home: () => seek(0), End: () => seek(1000),
      };
      if (moves[event.key]) { event.preventDefault(); moves[event.key](); return; }
      if (event.key === " " && target.tagName !== "BUTTON" && motion) { event.preventDefault(); toggle(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  return { rolling, ended, speed, progress, toggle, seek, cycleSpeed: () => { setSpeed(nextSpeed); if (motion && !ended) setRolling(true); } };
}
