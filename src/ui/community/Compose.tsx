import { useEffect, useState, type FormEvent } from 'react';
import { BOARD_CATEGORIES, boardRequest, isPost, type BoardCategory } from '../../api/community';
import { removeStored, useStoredState } from '../useStoredState';
import { loadNickname, saveNickname } from './shared';

export interface Draft { title: string; body: string; category: BoardCategory; spoiler: boolean }
const EMPTY: Draft = { title: '', body: '', category: 'question', spoiler: false };
// 초안은 탭 저장소에 둔다. 다른 화면에 다녀오거나 새로고침해도 쓰던 글이 남는다(비밀번호는 저장하지 않는다).
const DRAFT_KEY = 'incident-game/community/draft';

function reviveDraft(value: unknown): Draft | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== 'string' || typeof v.body !== 'string' || typeof v.spoiler !== 'boolean'
    || typeof v.category !== 'string' || !Object.hasOwn(BOARD_CATEGORIES, v.category)) return null;
  return { title: v.title, body: v.body, category: v.category as BoardCategory, spoiler: v.spoiler };
}

interface ComposeProps { preset?: Draft; onCreated: (id: number) => void; onCancel: () => void }

export function Compose({ preset, onCreated, onCancel }: ComposeProps) {
  const [draft, setDraft] = useStoredState<Draft>(DRAFT_KEY, () => preset ?? EMPTY, reviveDraft);
  const [author, setAuthor] = useState(loadNickname);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { title, body, category, spoiler } = draft;
  const edit = (patch: Partial<Draft>) => setDraft(current => ({ ...current, ...patch }));
  const blank = !title.trim() && !body.trim();
  // 다른 글을 쓰던 중에 회고 버튼으로 들어오면 덮어쓰지 않고 바꿀지 묻는다.
  const offerPreset = preset && !blank && title !== preset.title;
  // 빈 초안일 때만 실습 회고 양식을 채운다(쓰던 글은 그대로 둔다).
  useEffect(() => {
    if (preset && blank) setDraft(preset);
    // 양식 객체는 렌더마다 새로 만들어지므로 제목(=어느 실습의 회고인지)이 바뀔 때만 다시 본다.
  }, [preset?.title]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const post = await boardRequest('/posts', isPost, { author: author.trim(), title: title.trim(), body: body.trim(),
        category, spoiler, password: password.trim() || null });
      saveNickname(author.trim());
      setDraft(EMPTY);
      removeStored(DRAFT_KEY);
      onCreated(post.id);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function cancel() {
    if (blank || window.confirm('작성 중인 내용을 버리고 목록으로 돌아갈까요?')) { setDraft(EMPTY); removeStored(DRAFT_KEY); onCancel(); }
  }
  return <form className="board-compose board-panel" onSubmit={submit}>
    <div className="board-section-heading"><div><span className="board-eyebrow">NEW TRANSMISSION</span><h2>이야기 남기기</h2></div>
      <button type="button" disabled={busy} onClick={cancel}>작성 취소</button></div>
    {offerPreset && <p className="board-note board-preset">작성 중이던 초안을 이어서 보여 드려요.
      <button type="button" className="text-button" onClick={() => edit(preset)}>실습 회고 양식으로 바꾸기</button></p>}
    <fieldset disabled={busy}>
      <div className="board-form-row"><label>닉네임<input required maxLength={24} value={author} onChange={e => setAuthor(e.target.value)} placeholder="함께 공부하는 이름" /></label>
        <label>분류<select value={category} onChange={e => edit({ category: e.target.value as BoardCategory })}>
          {Object.entries(BOARD_CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select></label></div>
      <label>제목<input autoFocus required maxLength={100} value={title} onChange={e => edit({ title: e.target.value })} placeholder="어떤 이야기를 나누고 싶나요?" /></label>
      <label>내용<textarea required maxLength={10000} rows={12} value={body} onChange={e => edit({ body: e.target.value })}
        placeholder={'증상 → 확인한 명령 → 결과를 적어 주세요.\n명령어·로그는 ``` 줄로 감싸면 코드 상자로 보여요.'} /></label>
      <div className="board-form-row">
        <label><span>삭제 비밀번호 <em>선택</em></span><input type="password" autoComplete="new-password" minLength={4} maxLength={64} value={password}
          onChange={e => setPassword(e.target.value)} placeholder="4자 이상, 나중에 직접 지울 때" /></label>
        <label className="board-check"><input type="checkbox" checked={spoiler} onChange={e => edit({ spoiler: e.target.checked })} />
          <span><strong>풀이 포함</strong>원인·조치가 담겨 있으면 체크해 주세요. 목록에서 미리보기를 가리고, 읽는 사람이 직접 펼쳐 봅니다.</span></label>
      </div>
    </fieldset>
    <p className="board-note">닉네임은 인증되지 않습니다. 비밀 키·개인정보는 올리지 마세요. 삭제 비밀번호를 비워 두면 운영자만 지울 수 있어요.</p>
    {error && <p role="alert" className="board-inline-error">{error} 전송 결과가 불확실하면 목록을 확인한 뒤 다시 시도해 주세요.</p>}
    <div className="board-form-footer"><span>{body.length.toLocaleString()} / 10,000 · 초안은 이 탭에 자동 보관</span>
      <button className="primary" disabled={busy || !author.trim() || !title.trim() || !body.trim()}>{busy ? '등록 중…' : '게시글 등록 →'}</button></div>
  </form>;
}
