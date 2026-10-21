import { useEffect, useState } from 'react';
import { boardRequest } from '../../api/community';

export function useBoard<T>(path: string, valid: (v: unknown) => v is T) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setData(null);
    boardRequest(path, valid, undefined, controller.signal).then(value => {
      if (!controller.signal.aborted) setData(value);
    }).catch((e: Error) => {
      if (!controller.signal.aborted) setError(e.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [path, valid, revision]);
  return { data, error, loading, reload: () => setRevision(v => v + 1) };
}

export function BoardError({ message, retry }: { message: string; retry: () => void }) {
  return <div className="board-error" role="alert"><strong>{message}</strong>
    <p>게시판은 서버 연결이 필요합니다. 가상 장애 실습은 계속 이용할 수 있어요.</p>
    <button onClick={retry}>다시 불러오기</button></div>;
}
export function Pagination({ page, total, size, onPage }: { page: number; total: number; size: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return <nav className="board-pagination" aria-label="게시판 페이지">
    <button disabled={page <= 1} onClick={() => onPage(page - 1)}>← 이전</button>
    <span aria-live="polite">{page} / {pages}</span>
    <button disabled={page >= pages} onClick={() => onPage(page + 1)}>다음 →</button>
  </nav>;
}
export function BoardTime({ value }: { value: string }) {
  return <time dateTime={value}>{new Date(value).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })}</time>;
}

// 닉네임은 이 브라우저에서만 기억한다(편의 기능). 저장이 막힌 환경에서는 매번 비어 있다.
const NICKNAME_KEY = 'incident-game/community/nickname';
export function loadNickname(): string {
  try { return (localStorage.getItem(NICKNAME_KEY) ?? '').slice(0, 24); } catch { return ''; }
}
export function saveNickname(name: string) {
  try { localStorage.setItem(NICKNAME_KEY, name.slice(0, 24)); } catch { /* 저장 실패는 무시한다 */ }
}

/** 하루 안에 올라온 글. 목록에 NEW 표시를 단다. */
export function isFresh(createdAt: string, now = Date.now()): boolean {
  const age = now - Date.parse(createdAt);
  return age >= 0 && age < 24 * 60 * 60 * 1000;
}
