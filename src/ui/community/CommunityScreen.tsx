import { TerminalLoader } from "../components/TerminalLoader";
import { useState, type FormEvent, type MouseEvent } from 'react';
import { BOARD_CATEGORIES, isPostPage, type BoardCategory } from '../../api/community';
import { Icon } from '../components/Icon';
import { Compose, type Draft } from './Compose';
import { PostDetail } from './PostDetail';
import { AdminBar } from './moderation';
import { plainExcerpt } from './postFormat';
import { BoardError, BoardTime, ExampleTag, Pagination, isFresh, useBoard } from './shared';
import { CafeScene } from './cafe/CafeScene';
import './community.css';

interface CommunityScreenProps {
  postId?: number;
  writing: boolean;
  /** 실습 리포트에서 "회고 남기기"로 들어왔을 때 채워 둘 양식 */
  preset?: Draft;
  onOpen: (id?: number) => void;
  onWrite: () => void;
  /** 글을 올린 뒤 상세로. 뒤로 가기가 작성 화면으로 돌아가지 않게 주소를 바꿔 끼운다. */
  onCreated: (id: number) => void;
  /** 앱의 모션 설정. 카페 손님이 걸어 다닐지 정한다. */
  motion: boolean;
  /** 모든 운영실의 장애를 해결했으면 카페도 파티 중 */
  party: boolean;
}

export function CommunityScreen({ postId, writing, preset, onOpen, onWrite, onCreated, motion, party }: CommunityScreenProps) {
  // 운영자 키는 이 화면의 메모리에만 둔다. 저장소에 쓰지 않으므로 새로고침하거나 게시판을 떠나면 사라진다.
  const [adminKey, setAdminKey] = useState<string | null>(null);
  return <section className="community-screen">
    <header className="board-hero">
      <div><span className="board-eyebrow"><i /> COMMUNITY LOUNGE</span><h1>장애 뒤에, 한 잔의 대화.</h1>
        <p>막혔던 순간도, 해결한 기쁨도.<br />함께 배우는 운영자들의 작은 카페입니다.</p>
        <div className="board-hero-tags"><span>질문을 편하게</span><span>경험을 솔직하게</span><span>서로에게 친절하게</span></div></div>
      <div className="board-coffee" aria-hidden="true"><div className="board-steam"><i /><i /><i /></div><div className="board-cup">$ brew ideas</div><div className="board-saucer" /><small>TAKE A BREAK · SHARE A FIX</small></div>
    </header>
    <AdminBar adminKey={adminKey} onChange={setAdminKey} />
    {postId !== undefined ? <><button className="text-button board-back" onClick={() => onOpen()}>← 게시판 목록</button>
        <PostDetail key={postId} id={postId} adminKey={adminKey} onDeleted={() => onOpen()} /></>
      : writing ? <Compose preset={preset} onCancel={() => onOpen()} onCreated={onCreated} />
      : <><CafeScene motion={motion} party={party} onOpen={onOpen} onWrite={onWrite} /><BoardList onOpen={onOpen} onWrite={onWrite} /></>}
  </section>;
}

/** 보통 클릭만 화면 안에서 연다. 새 탭·창으로 여는 클릭은 브라우저에 맡긴다. */
function plainClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function BoardList({ onOpen, onWrite }: { onOpen: (id: number) => void; onWrite: () => void }) {
  const [category, setCategory] = useState<BoardCategory | ''>('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), q: query });
  if (category) params.set('category', category);
  const list = useBoard(`/posts?${params}`, isPostPage);
  function submit(e: FormEvent) { e.preventDefault(); setPage(1); setQuery(search.trim()); }
  return <div className="board-layout"><div className="board-main">
    <div className="board-section-heading"><div><span className="board-eyebrow">COMMUNITY BOARD</span><h2>오늘의 이야기 <span>{list.data?.total ?? '—'}</span></h2></div>
      <a className="primary board-write" href="#/community/write" onClick={e => { if (plainClick(e)) { e.preventDefault(); onWrite(); } }}>＋ 글쓰기</a></div>
    <div className="board-filters" aria-label="게시글 분류">
      {([['', '전체'], ...Object.entries(BOARD_CATEGORIES)]).map(([id, label]) => <button key={id} aria-pressed={category === id}
        onClick={() => { setCategory(id as BoardCategory | ''); setPage(1); }}>{label}</button>)}
    </div>
    <form className="board-search" onSubmit={submit}><Icon name="search" size={18} /><input aria-label="게시글 검색" maxLength={100} placeholder="제목이나 내용으로 이야기 찾기" value={search} onChange={e => setSearch(e.target.value)} />
      <button type="submit">검색</button>{query && <button type="button" aria-label="검색 초기화" onClick={() => { setSearch(''); setQuery(''); setPage(1); }}>×</button>}</form>
    {list.loading && <div className="board-empty"><TerminalLoader label="이야기를 불러오고 있어요…" /></div>}
    {list.error && <BoardError message={list.error} retry={list.reload} />}
    {list.data && <>
      {list.data.items.length === 0 ? <div className="board-empty"><span aria-hidden="true">☕</span><h3>{query || category ? '아직 이 주제의 이야기가 없어요' : '첫 번째 테이블이 비어 있어요'}</h3>
        <p>{query || category ? '다른 검색어나 분류를 골라 보세요.' : '오늘 배운 것 하나, 궁금한 것 하나로 시작해 볼까요?'}</p><button onClick={onWrite}>첫 이야기 남기기</button></div>
        : <div className="board-posts">{list.data.items.map(post => <article className="board-post" key={post.id}>
          <div className="board-post-top"><span className={`board-tag ${post.category}`}>{BOARD_CATEGORIES[post.category]}</span>
            {post.spoiler && <span className="board-spoiler-tag">풀이 포함</span>}
            {post.example && <ExampleTag />}
            {isFresh(post.created_at) && <span className="board-new">NEW</span>}
            <span className="board-post-number">#{post.id.toString().padStart(3, '0')}</span></div>
          <h3><a href={`#/community/${post.id}`} onClick={e => { if (plainClick(e)) { e.preventDefault(); onOpen(post.id); } }}>{post.title}</a></h3>
          <p className="board-excerpt">{post.spoiler ? '원인·조치가 담긴 글이라 미리보기를 가렸어요. 열어서 직접 펼쳐 보세요.' : plainExcerpt(post.excerpt)}</p>
          <div className="board-meta"><strong>{post.author}</strong><BoardTime value={post.created_at} /><span className="board-replies">댓글 {post.comment_count}</span></div>
        </article>)}</div>}
      {list.data.total > 0 && <Pagination page={page} total={list.data.total} size={list.data.page_size} onPage={setPage} />}
    </>}
  </div><aside className="board-aside board-panel"><span className="board-eyebrow">HOUSE RULES</span><h3>좋은 질문은<br />함께 푸는 시작.</h3><ol><li>어떤 증상이 있었나요?</li><li>어떤 명령을 실행했나요?</li><li>예상과 무엇이 달랐나요?</li></ol><div className="board-aside-divider" /><p>정답을 바로 알려주기보다<br />다음에 확인할 단서를 나눠요.<br />풀이가 담기면 <b>풀이 포함</b>을 체크해 주세요.</p><small>닉네임으로 참여하는 공개 공간입니다. 비밀 키와 개인정보는 제외해 주세요. 삭제 비밀번호를 정해 두면 직접 지울 수 있어요.</small></aside></div>;
}
