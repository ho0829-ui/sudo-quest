import { Fragment, useState, type FormEvent } from 'react';
import { checkAdminKey, deleteAsAdmin, deleteAsAuthor, type DeleteTarget } from '../../api/community';
import { parsePostBody } from './postFormat';

/** 글·댓글 본문. 코드 블록은 줄바꿈·들여쓰기를 그대로 두고, 나머지는 문단으로 그린다. */
export function PostBody({ text }: { text: string }) {
  return <div className="board-prose">{parsePostBody(text).map((block, i) => block.kind === 'code'
    ? <pre key={i} className="board-code" data-lang={block.lang || undefined}><code>{block.text}</code></pre>
    : <p key={i}>{block.parts.map((part, j) => part.kind === 'code'
      ? <code key={j}>{part.text}</code> : <Fragment key={j}>{part.text}</Fragment>)}</p>)}</div>;
}

interface DeleteControlProps { target: DeleteTarget; deletable: boolean; adminKey: string | null; label: string; onDeleted: () => void }

/**
 * 삭제 버튼. 운영자 모드면 확인 후 바로 지우고, 아니면 작성자가 정한 삭제 비밀번호를 묻는다.
 * 비밀번호 없이 쓴 글은 작성자 삭제 버튼 자체를 보이지 않는다.
 */
export function DeleteControl({ target, deletable, adminKey, label, onDeleted }: DeleteControlProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!adminKey && !deletable) return null;
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('');
    try { await action(); onDeleted(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  function close() { setOpen(false); setPassword(''); setError(''); }
  if (adminKey) {
    return <span className="board-delete">
      <button type="button" className="board-delete-button" disabled={busy} onClick={() => {
        if (window.confirm(`이 ${label}을(를) 운영자 권한으로 삭제할까요? 되돌릴 수 없습니다.`)) void run(() => deleteAsAdmin(target, adminKey));
      }}>운영자 삭제</button>
      {error && <span role="alert" className="board-inline-error">{error}</span>}
    </span>;
  }
  if (!open) return <button type="button" className="board-delete-button" onClick={() => setOpen(true)}>삭제</button>;
  function submit(e: FormEvent) { e.preventDefault(); void run(() => deleteAsAuthor(target, password)); }
  return <form className="board-delete-form" onSubmit={submit}>
    <label>{label} 삭제 비밀번호<input type="password" autoComplete="off" autoFocus maxLength={64} value={password} onChange={e => setPassword(e.target.value)} /></label>
    <button type="submit" disabled={busy || !password}>{busy ? '삭제 중…' : '삭제'}</button>
    <button type="button" className="text-button" onClick={close}>취소</button>
    {error && <p role="alert" className="board-inline-error">{error}</p>}
  </form>;
}

/**
 * 운영자 모드. 서버 .env의 COMMUNITY_ADMIN_KEY를 운영자가 직접 입력하면 서버에 확인한 뒤 이 화면의 메모리에만 둔다.
 * 브라우저 저장소에 쓰지 않으므로 새로고침하거나 게시판을 떠나면 꺼진다.
 */
export function AdminBar({ adminKey, onChange }: { adminKey: string | null; onChange: (key: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (adminKey) {
    return <div className="board-admin on" role="status"><strong><i /> 운영자 모드</strong>
      <span>모든 글·댓글에 삭제 버튼이 보입니다. 새로고침하거나 게시판을 떠나면 꺼져요.</span>
      <button type="button" onClick={() => onChange(null)}>끄기</button></div>;
  }
  if (!open) return <div className="board-admin"><button type="button" className="text-button" onClick={() => setOpen(true)}>운영자 모드</button></div>;
  async function submit(e: FormEvent) {
    e.preventDefault();
    const key = value.trim();
    setBusy(true); setError('');
    try { await checkAdminKey(key); setValue(''); setOpen(false); onChange(key); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <form className="board-admin open" onSubmit={submit}>
    <label>운영자 키<input type="password" autoComplete="off" autoFocus maxLength={200} value={value} onChange={e => setValue(e.target.value)} /></label>
    <button type="submit" disabled={busy || !value.trim()}>{busy ? '확인 중…' : '켜기'}</button>
    <button type="button" className="text-button" onClick={() => { setOpen(false); setValue(''); setError(''); }}>닫기</button>
    <small>서버의 COMMUNITY_ADMIN_KEY 값입니다. 화면 메모리에만 두고 저장하지 않습니다.</small>
    {error && <p role="alert" className="board-inline-error">{error}</p>}
  </form>;
}
