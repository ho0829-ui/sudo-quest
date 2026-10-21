import { useState, type FormEvent } from 'react';
import { BOARD_CATEGORIES, boardRequest, isPost, isComment, isCommentPage } from '../../api/community';
import { BoardError, BoardTime, Pagination, loadNickname, saveNickname, useBoard } from './shared';
import { DeleteControl, PostBody } from './moderation';

interface PostDetailProps { id: number; adminKey: string | null; onDeleted: () => void }

export function PostDetail({ id, adminKey, onDeleted }: PostDetailProps) {
  const post = useBoard(`/posts/${id}`, isPost);
  const [page, setPage] = useState(1);
  const comments = useBoard(`/posts/${id}/comments?page=${page}`, isCommentPage);
  const [revealed, setRevealed] = useState(false);
  const [author, setAuthor] = useState(loadNickname);
  const [body, setBody] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await boardRequest(`/posts/${id}/comments`, isComment, { author: author.trim(), body: body.trim(), password: password.trim() || null });
      saveNickname(author.trim());
      setBody(''); setPassword(''); setNotice('댓글을 등록했습니다.');
      // 등록 후 서버의 최신 개수로 마지막 페이지를 구한다(다른 사람의 동시 작성 포함).
      const latest = await boardRequest(`/posts/${id}/comments?page=1`, isCommentPage);
      setPage(Math.max(1, Math.ceil(latest.total / latest.page_size)));
      comments.reload();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (post.loading) return <p role="status" className="board-empty">이야기를 불러오고 있어요…</p>;
  if (post.error) return <BoardError message={post.error} retry={post.reload} />;
  if (!post.data) return null;
  const item = post.data;
  const hidden = item.spoiler && !revealed;
  return <div className="board-detail">
    <article className="board-panel">
      <div className="board-post-top"><span className={`board-tag ${item.category}`}>{BOARD_CATEGORIES[item.category]}</span>
        {item.spoiler && <span className="board-spoiler-tag">풀이 포함</span>}
        <DeleteControl target={{ kind: 'post', id: item.id }} deletable={item.deletable} adminKey={adminKey} label="글" onDeleted={onDeleted} /></div>
      <h2>{item.title}</h2><div className="board-meta"><strong>{item.author}</strong><BoardTime value={item.created_at} /></div>
      {hidden
        ? <div className="board-spoiler-gate"><strong>원인과 조치가 담긴 회고예요.</strong>
            <p>아직 이 실습을 풀지 않았다면 먼저 도전해 보고 돌아오는 걸 추천해요.</p>
            <button type="button" onClick={() => setRevealed(true)}>내용 펼치기</button></div>
        : <PostBody text={item.body} />}
    </article>
    <section className="board-panel" aria-label="댓글"><h3>함께 나누는 이야기 {comments.data && <span>{comments.data.total}</span>}</h3>
      {comments.loading && <p role="status">댓글을 불러오고 있어요…</p>}
      {comments.error && <BoardError message={comments.error} retry={comments.reload} />}
      {comments.data && <>
        {comments.data.items.length === 0 && <p className="board-note">첫 번째 응원을 남겨 주세요.</p>}
        {comments.data.items.map(comment => <article className="board-comment" key={comment.id}>
          <div className="board-meta"><strong>{comment.author}</strong><BoardTime value={comment.created_at} />
            <DeleteControl target={{ kind: 'comment', id: comment.id }} deletable={comment.deletable} adminKey={adminKey} label="댓글" onDeleted={comments.reload} /></div>
          {!hidden && <PostBody text={comment.body} />}
          {hidden && <p className="board-note">본문을 펼치면 댓글 내용도 함께 보여요.</p>}
        </article>)}
        {comments.data.total > comments.data.page_size && <Pagination page={page} total={comments.data.total} size={comments.data.page_size} onPage={setPage} />}
      </>}
      <form onSubmit={submit} className="board-comment-form"><fieldset disabled={busy}>
        <div className="board-form-row">
          <label>댓글 닉네임<input required maxLength={24} value={author} onChange={e => setAuthor(e.target.value)} placeholder="닉네임" /></label>
          <label><span>삭제 비밀번호 <em>선택</em></span><input type="password" autoComplete="new-password" minLength={4} maxLength={64} value={password} onChange={e => setPassword(e.target.value)} placeholder="4자 이상" /></label>
        </div>
        <label>댓글 내용<textarea required maxLength={2000} rows={3} value={body} onChange={e => setBody(e.target.value)} placeholder="확인해 볼 방법이나 경험을 나눠 주세요. `명령`은 백틱으로 감싸요." /></label>
      </fieldset>
        {error && <p role="alert" className="board-inline-error">{error} 재전송 전 댓글 목록을 확인해 주세요.</p>}
        <div className="board-form-footer"><span role="status">{notice || `${body.length} / 2,000`}</span>
          <button className="primary" disabled={busy || !author.trim() || !body.trim()}>{busy ? '등록 중…' : '댓글 등록'}</button></div>
      </form>
    </section>
  </div>;
}
