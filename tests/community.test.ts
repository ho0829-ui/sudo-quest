import { afterEach, describe, expect, it, vi } from 'vitest';
import { boardRequest, isPost, isPostPage, isCommentPage, CommunityError } from '../src/api/community';
import { formatRoute, parseRoute } from '../src/ui/route';

const post = { id: 1, title: '질문', author: '동료', category: 'question', body: '<script>alert(1)</script>', created_at: '2026-10-22T10:00:00+00:00', spoiler: false, deletable: false };
const { body: _body, deletable: _deletable, ...summary } = post;
const page = { items: [{ ...summary, excerpt: '내용', comment_count: 0 }], total: 1, page: 1, page_size: 20 };
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('게시판 계약과 라우팅', () => {
  it('목록과 상세 링크를 새로고침·뒤로가기에 사용할 수 있다', () => {
    for (const route of [{ kind: 'community' as const }, { kind: 'community' as const, postId: 42 }]) {
      expect(parseRoute(formatRoute(route), 14)).toEqual(route);
    }
    for (const path of ['#/community/0', '#/community/-1', '#/community/9007199254740992', '#/community/1/extra']) {
      expect(parseRoute(path, 14)).toEqual({ kind: 'home' });
    }
  });
  it('손상된 중첩 응답을 거부한다', () => {
    expect(isPost(post)).toBe(true);
    expect(isPostPage(page)).toBe(true);
    for (const broken of [{ ...post, id: -1 }, { ...post, category: '__proto__' }, { ...post, created_at: 'bad' }, { ...post, body: {} },
      { ...post, spoiler: 'yes' }, { ...post, deletable: undefined }]) expect(isPost(broken)).toBe(false);
    expect(isPostPage({ ...page, items: [post] })).toBe(false);
    expect(isPostPage({ ...page, total: -1 })).toBe(false);
    expect(isCommentPage({ ...page, items: [{ ...post, post_id: null }] })).toBe(false);
  });
  it('응답을 검사하고 작성 요청에 비밀 키를 넣지 않는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(post), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await boardRequest('/posts', isPost, { title: '질문' })).toEqual(post);
    expect(fetcher.mock.calls[0][1].headers).toEqual({ 'Content-Type': 'application/json' });
    expect(fetcher.mock.calls[0][1].method).toBe('POST');
  });
  it('HTML 오류 페이지나 잘못된 JSON을 화면 데이터로 사용하지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>error</html>')));
    await expect(boardRequest('/posts', isPostPage)).rejects.toBeInstanceOf(CommunityError);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }))));
    await expect(boardRequest('/posts', isPostPage)).rejects.toMatchObject({ status: 502 });
  });
  it('429를 알려주고 쓰기를 자동 재전송하지 않는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 429 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(boardRequest('/posts', isPost, post)).rejects.toThrow('1분');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('오프라인 오류를 안내한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')));
    await expect(boardRequest('/posts', isPostPage)).rejects.toThrow('서버에 연결');
  });
  it('요청 취소를 내부 fetch에 전달한다', async () => {
    const caller = new AbortController();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const pending = boardRequest('/posts', isPostPage, undefined, caller.signal);
    caller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('응답 없는 서버는 10초 후 종료한다', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })));
    const checked = expect(boardRequest('/posts', isPostPage)).rejects.toThrow('서버에 연결');
    await vi.advanceTimersByTimeAsync(10000);
    await checked;
  });
});
