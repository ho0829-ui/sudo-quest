import { useEffect, useRef } from "react";

/**
 * 전체 화면 창(피날레·엔딩 크레딧) 공통 동작: 열리면 첫 버튼에 포커스, Tab은 창 안에서만 돌고,
 * Esc로 닫으며, 뒤 페이지는 스크롤되지 않는다. 닫히면 원래 포커스로 돌아간다.
 */
export function useDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const root = ref.current;
    const before = document.activeElement as HTMLElement | null;
    const focusables = () => [...(root?.querySelectorAll<HTMLElement>("button, a[href], [tabindex='0']") ?? [])].filter(el => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close.current(); return; }
      if (event.key !== "Tab") return;
      const list = focusables();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);
  return ref;
}
