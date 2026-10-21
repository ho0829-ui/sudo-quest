import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommunityError, checkAdminKey, deleteAsAdmin, deleteAsAuthor } from '../src/api/community';
import { missionDraft, parsePostBody, parsePostInline, plainExcerpt } from '../src/ui/community/postFormat';
import { isFresh } from '../src/ui/community/shared';
import { formatRoute, parseRoute } from '../src/ui/route';
import { scenarios } from '../src/scenarios';

afterEach(() => { vi.unstubAllGlobals(); });

describe('게시글 본문 서식', () => {
  it('``` 코드 블록은 줄바꿈·들여쓰기를 그대로 두고 언어 이름을 읽는다', () => {
    const blocks = parsePostBody('증상\n```bash\ndf -h\n  du -sh /var/log\n```\n끝');
    expect(blocks).toEqual([
      { kind: 'text', parts: [{ kind: 'text', text: '증상' }] },
      { kind: 'code', lang: 'bash', text: 'df -h\n  du -sh /var/log' },
      { kind: 'text', parts: [{ kind: 'text', text: '끝' }] },
    ]);
  });
  it('닫히지 않은 ```와 HTML은 글자 그대로 둔다', () => {
    expect(parsePostBody('```\nrm -rf <script>')).toEqual([{ kind: 'text', parts: [{ kind: 'text', text: '```\nrm -rf <script>' }] }]);
    expect(parsePostBody('a\r\n```\r\nx\r\n```')).toEqual([{ kind: 'text', parts: [{ kind: 'text', text: 'a' }] }, { kind: 'code', lang: '', text: 'x' }]);
  });
  it('목록 미리보기에서는 ``` 줄과 백틱 표시를 뺀다', () => {
    expect(plainExcerpt('`df -h`로 확인\n```bash\ndf -h\n```\n\n끝')).toBe('df -h로 확인\ndf -h\n끝');
  });
  it('한 줄 안의 `코드`만 코드로 바꾸고 짝 없는 백틱은 남긴다', () => {
    expect(parsePostInline('`df -h` 결과 `와')).toEqual([{ kind: 'code', text: 'df -h' }, { kind: 'text', text: ' 결과 `와' }]);
  });
});

describe('실습 회고 양식', () => {
  it('공개된 번호·제목만 쓰고 원인·풀이·시나리오 ID를 담지 않는다', () => {
    scenarios.forEach((scenario, index) => {
      const draft = missionDraft(index + 1, scenario.title);
      const text = JSON.stringify(draft);
      expect(draft.title.startsWith(`[MISSION ${String(index + 1).padStart(2, '0')} 회고]`)).toBe(true);
      expect(draft.title.length).toBeLessThanOrEqual(100);
      expect(draft).toMatchObject({ category: 'review', spoiler: true });
      for (const secret of [scenario.id, scenario.rootCause.answerId, ...scenario.rootCause.choices.map(c => c.label), ...scenario.solutionPath]) {
        if (secret.length >= 4 && !scenario.title.includes(secret)) expect(text).not.toContain(secret);
      }
    });
  });
});

describe('게시판 주소', () => {
  it('글쓰기·회고 글쓰기 주소를 오가고, 없는 실습 번호는 빈 글쓰기로 연다', () => {
    for (const route of [{ kind: 'community' as const, write: true }, { kind: 'community' as const, write: true, mission: 3 }]) {
      expect(parseRoute(formatRoute(route), 14)).toEqual(route);
    }
    expect(parseRoute('#/community/write/99', 14)).toEqual({ kind: 'community', write: true });
    expect(parseRoute('#/community/write/abc', 14)).toEqual({ kind: 'community', write: true });
    expect(parseRoute('#/community/write/1/extra', 14)).toEqual({ kind: 'home' });
  });
});

describe('삭제와 운영자 요청', () => {
  it('작성자 삭제는 비밀번호를 본문으로만 보내고 Authorization을 싣지 않는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await deleteAsAuthor({ kind: 'comment', id: 7 }, 'cafe-4321');
    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe('/api/community/comments/7/delete');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body)).toEqual({ password: 'cafe-4321' });
  });
  it('운영자 키는 확인·삭제 요청의 Authorization 헤더에만 싣는다', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);
    await checkAdminKey('k'.repeat(40));
    await deleteAsAdmin({ kind: 'post', id: 3 }, 'k'.repeat(40));
    expect(fetcher.mock.calls.map(([url, init]) => [url, init.method, init.headers.Authorization, init.body])).toEqual([
      ['/api/community/admin', 'GET', `Bearer ${'k'.repeat(40)}`, undefined],
      ['/api/community/posts/3', 'DELETE', `Bearer ${'k'.repeat(40)}`, undefined],
    ]);
  });
  it('서버의 오류 코드로 403의 이유를 구분해 안내한다', async () => {
    const reply = (status: number, detail: string) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail }), { status }));
    vi.stubGlobal('fetch', reply(403, 'wrong_password'));
    await expect(deleteAsAuthor({ kind: 'post', id: 1 }, 'x')).rejects.toThrow('비밀번호가 맞지 않습니다');
    vi.stubGlobal('fetch', reply(403, 'author_delete_disabled'));
    await expect(deleteAsAuthor({ kind: 'post', id: 1 }, 'x')).rejects.toThrow('운영자만');
    vi.stubGlobal('fetch', reply(401, 'unauthorized'));
    await expect(checkAdminKey('wrong')).rejects.toMatchObject({ status: 401 });
    vi.stubGlobal('fetch', reply(403, 'origin_not_allowed'));
    await expect(deleteAsAuthor({ kind: 'post', id: 1 }, 'x')).rejects.toBeInstanceOf(CommunityError);
  });
});

describe('NEW 표시', () => {
  it('하루 안에 올라온 글만 새 글이다', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(isFresh('2026-10-22T01:00:00Z', now)).toBe(true);
    expect(isFresh('2026-10-21T11:59:00Z', now)).toBe(false);
    expect(isFresh('2026-10-23T00:00:00Z', now)).toBe(false);
  });
});
