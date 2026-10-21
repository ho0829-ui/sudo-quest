/**
 * 탭 저장소(sessionStorage)에 함께 보관되는 React 상태.
 * 근거 링크를 눌러 페이지를 떠났다가 돌아와도 코치·지식 대화가 남아 있게 한다.
 * 저장이 막힌 환경(사생활 보호 모드 등)에서는 그냥 메모리 상태처럼 동작한다.
 */
import { useEffect, useState } from "react";

function read<T>(key: string, initial: () => T, revive?: (value: unknown) => T | null): T {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return initial();
    const parsed: unknown = JSON.parse(raw);
    return (revive ? revive(parsed) : (parsed as T)) ?? initial();
  } catch {
    return initial();
  }
}

/**
 * key가 바뀌면(새 실습 등) 그 key의 저장본을 다시 읽는다.
 * revive는 저장본을 읽을 때만 적용한다(형식 검사, 응답 대기 중이던 턴 정리 등).
 */
export function useStoredState<T>(
  key: string, initial: () => T, revive?: (value: unknown) => T | null,
): [T, (next: T | ((previous: T) => T)) => void] {
  const [state, setState] = useState(() => ({ key, value: read(key, initial, revive) }));
  useEffect(() => {
    if (state.key !== key) setState({ key, value: read(key, initial, revive) });
  }, [key]);
  // 값이 바뀔 때마다 저장한다. 업데이트 함수 안에서 저장하지 않는 건 React가 그 함수를 두 번 부를 수 있어서다.
  useEffect(() => {
    if (state.key !== key) return;
    try { sessionStorage.setItem(key, JSON.stringify(state.value)); } catch { /* 저장 실패는 무시한다 */ }
  }, [state, key]);
  const value = state.key === key ? state.value : read(key, initial, revive);
  function update(next: T | ((previous: T) => T)) {
    setState((current) => {
      const base = current.key === key ? current.value : read(key, initial, revive);
      return { key, value: typeof next === "function" ? (next as (previous: T) => T)(base) : next };
    });
  }
  return [value, update];
}

/**
 * 저장본을 바로 지운다. 저장은 렌더 뒤 효과에서 일어나므로, 값을 비우자마자 화면을 떠나는 경우
 * (예: 글 등록 직후 상세로 이동)에는 빈 값이 저장되기 전에 컴포넌트가 사라진다. 그때 이걸 함께 부른다.
 */
export function removeStored(key: string) {
  try { sessionStorage.removeItem(key); } catch { /* 저장소가 막힌 환경은 무시한다 */ }
}

/** 응답을 기다리던 중 페이지를 떠난 턴은 되살릴 때 다시 물어보라고 표시한다. */
export function settlePending<T extends { result?: unknown; error?: string }>(turns: T[]): T[] {
  return turns.map((turn) => (turn.result || turn.error ? turn : { ...turn, error: "페이지를 떠나 있는 동안 응답을 받지 못했습니다. 다시 물어봐 주세요." }));
}
