export const BOARD_CATEGORIES = { question: '질문', tip: '운영 팁', review: '장애 회고', free: '자유 이야기' } as const;
export type BoardCategory = keyof typeof BOARD_CATEGORIES;
export interface PostSummary {
  id: number; title: string; author: string; category: BoardCategory; created_at: string;
  /** 풀이가 담긴 글이면 서버가 빈 문자열을 보낸다(목록 스포일러 방지). */
  excerpt: string; comment_count: number; spoiler: boolean;
  /** 시드 스크립트가 넣은 예시 글. 예전 서버는 이 필드를 보내지 않는다. */
  example?: boolean;
}
export interface Post extends Omit<PostSummary, 'excerpt' | 'comment_count'> { body: string; deletable: boolean }
export interface Comment { id: number; post_id: number; author: string; body: string; created_at: string; deletable: boolean; example?: boolean }
export interface Page<T> { items: T[]; total: number; page: number; page_size: number }
export interface PostInput { title: string; body: string; author: string; category: BoardCategory; spoiler: boolean; password: string | null }
export interface CommentInput { author: string; body: string; password: string | null }

type RecordValue = Record<string, unknown>;
const record = (v: unknown): v is RecordValue => typeof v === 'object' && v !== null && !Array.isArray(v);
const integer = (v: unknown, min = 0): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
const text = (v: unknown): v is string => typeof v === 'string';
const flag = (v: unknown): v is boolean => typeof v === 'boolean';
const dated = (v: unknown): v is string => text(v) && Number.isFinite(Date.parse(v));
const optionalFlag = (v: unknown) => v === undefined || flag(v);
const category = (v: unknown): v is BoardCategory => text(v) && Object.hasOwn(BOARD_CATEGORIES, v);
export const isPost = (v: unknown): v is Post => record(v) && integer(v.id, 1) && text(v.title)
  && text(v.author) && category(v.category) && dated(v.created_at) && text(v.body) && flag(v.spoiler) && flag(v.deletable) && optionalFlag(v.example);
const isSummary = (v: unknown): v is PostSummary => record(v) && integer(v.id, 1) && text(v.title)
  && text(v.author) && category(v.category) && dated(v.created_at) && text(v.excerpt) && integer(v.comment_count) && flag(v.spoiler) && optionalFlag(v.example);
export const isComment = (v: unknown): v is Comment => record(v) && integer(v.id, 1) && integer(v.post_id, 1)
  && text(v.author) && text(v.body) && dated(v.created_at) && flag(v.deletable) && optionalFlag(v.example);
function isPage<T>(v: unknown, item: (v: unknown) => v is T): v is Page<T> {
  return record(v) && integer(v.total) && integer(v.page, 1) && integer(v.page_size, 1)
    && v.page_size <= 50 && Array.isArray(v.items) && v.items.length <= v.page_size && v.items.every(item);
}
export const isPostPage = (v: unknown): v is Page<PostSummary> => isPage(v, isSummary);
export const isCommentPage = (v: unknown): v is Page<Comment> => isPage(v, isComment);

// 서버가 detail에 담아 보내는 오류 코드 → 사용자 안내. 상태 코드만으로는 403(주소·비밀번호)을 구분할 수 없다.
const CODE_MESSAGES: Record<string, string> = {
  wrong_password: '삭제 비밀번호가 맞지 않습니다.',
  author_delete_disabled: '삭제 비밀번호 없이 쓴 글이라 운영자만 지울 수 있어요.',
  comment_not_found: '댓글을 찾을 수 없습니다. 이미 삭제되었을 수 있어요.',
  moderation_disabled: '서버에 운영자 키가 설정되어 있지 않습니다. backend/.env의 COMMUNITY_ADMIN_KEY를 확인해 주세요.',
  unauthorized: '운영자 키가 맞지 않습니다.',
};

export class CommunityError extends Error {
  constructor(public status: number, public code = '') {
    super(CODE_MESSAGES[code] ?? (status === 404 ? '글을 찾을 수 없습니다. 삭제되었을 수 있어요.'
      : status === 429 ? '잠시 쉬어 갈까요? 1분 뒤에 다시 시도해 주세요.'
      : status === 422 ? '입력 길이와 내용을 확인해 주세요.'
      : status === 403 ? '이 주소에서는 게시글을 작성할 수 없습니다.'
      : '게시판 서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'));
  }
}

async function errorCode(response: Response): Promise<string> {
  try {
    const data: unknown = await response.json();
    return record(data) && text(data.detail) ? data.detail : '';
  } catch { return ''; }
}

interface SendOptions { method?: 'GET' | 'POST' | 'DELETE'; body?: object; headers?: Record<string, string>; signal?: AbortSignal }

/** 모든 요청은 10초 제한, 호출자가 취소할 수 있다. 쓰기는 자동 재전송하지 않는다. */
async function send(path: string, { method = 'GET', body, headers, signal }: SendOptions): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 10000);
  try {
    const response = await fetch(`/api/community${path}`, { signal: controller.signal, method: body ? 'POST' : method,
      ...(body ? { headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) } : headers ? { headers } : {}) });
    if (!response.ok) throw new CommunityError(response.status, await errorCode(response));
    return response;
  } catch (error) {
    if (signal?.aborted) throw error;
    throw error instanceof CommunityError ? error : new CommunityError(0);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

/** 조회·작성. 응답 모양을 검사해 통과한 값만 화면에 넘긴다. */
export async function boardRequest<T>(path: string, valid: (v: unknown) => v is T,
  input?: object, signal?: AbortSignal): Promise<T> {
  const response = await send(path, { body: input, signal });
  let data: unknown;
  try { data = await response.json(); } catch { throw new CommunityError(502); }
  if (!valid(data)) throw new CommunityError(502);
  return data;
}

export type DeleteTarget = { kind: 'post' | 'comment'; id: number };
const targetPath = ({ kind, id }: DeleteTarget) => `/${kind === 'post' ? 'posts' : 'comments'}/${id}`;

/** 작성자 삭제: 글·댓글을 쓸 때 정한 비밀번호를 본문으로 보낸다. */
export async function deleteAsAuthor(target: DeleteTarget, password: string): Promise<void> {
  await send(`${targetPath(target)}/delete`, { body: { password } });
}

/**
 * 운영자 키는 코드·환경 변수에 없다. 운영자가 화면에 입력한 값을 이 탭의 메모리에서만 들고 다니며
 * 확인·삭제 요청의 Authorization 헤더에만 싣는다.
 */
export async function checkAdminKey(key: string): Promise<void> {
  await send('/admin', { headers: { Authorization: `Bearer ${key}` } });
}
export async function deleteAsAdmin(target: DeleteTarget, key: string): Promise<void> {
  await send(targetPath(target), { method: 'DELETE', headers: { Authorization: `Bearer ${key}` } });
}
