/**
 * 카페 손님 = 최근에 글을 쓴 사람. 게시판 목록(공개 정보)만으로 만든다.
 * 같은 닉네임은 한 사람으로 묶고 가장 최근 글을 말풍선에 띄운다. 옷 색은 닉네임에서 정해 늘 같다.
 */
import type { BoardCategory, PostSummary } from "../../../api/community";
import { isFresh } from "../shared";

export interface Outfit { shirt: string; pants: string; hair: string; skin: string }

export interface Visitor {
  /** 닉네임. 한 카페 안에서 사람을 구분하는 키다. */
  author: string;
  postId: number;
  title: string;
  /** 말풍선에 넣을 줄인 제목 */
  short: string;
  category: BoardCategory;
  comments: number;
  createdAt: string;
  /** 하루 안의 글. 문으로 걸어 들어오고 NEW를 단다. */
  fresh: boolean;
  /** 시드 스크립트가 넣은 예시 글 */
  example: boolean;
  /** 이 사람이 최근 목록에 쓴 글 수 */
  posts: number;
  outfit: Outfit;
}

export const MAX_VISITORS = 14;
export const MAX_VISITORS_NARROW = 6;
export const BUBBLE_CHARS = 12;
/** 좁은 화면은 장면이 작게 그려지므로 말풍선 글자를 키우고 대신 더 짧게 줄인다. */
export const BUBBLE_CHARS_NARROW = 8;

/** 말풍선 테두리 색. 게시판 목록의 분류 태그 색과 맞춘다. */
export const CATEGORY_COLORS: Record<BoardCategory, string> = {
  question: "#c8bbff", tip: "#80dcc3", review: "#ffbf88", free: "#9ecdf9",
};

const SHIRTS = ["#ffb3c7", "#7fc8a9", "#8fb3ff", "#ffd08a", "#c96a4a", "#e06a6a", "#b48bff", "#5cc8ff", "#f4f1ea", "#3a5a40"];
const PANTS = ["#1d2433", "#2b3a55", "#4a2c1a", "#3a2f55", "#14181f"];
const HAIR = ["#121212", "#2a1d18", "#6b4a2f", "#c98d4b", "#3b2a20", "#7a3b1d"];
const SKIN = ["#f2c9a0", "#e0b48a", "#c99a73", "#b9835a"];

/** 문자열 → 0 이상의 정수. 같은 닉네임은 늘 같은 값(같은 옷)이 된다. */
export function hashName(name: string): number {
  let h = 2166136261;
  for (const ch of name) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619);
  return h >>> 0;
}

export function outfitOf(name: string): Outfit {
  const h = hashName(name);
  return { shirt: SHIRTS[h % SHIRTS.length], pants: PANTS[(h >>> 4) % PANTS.length], hair: HAIR[(h >>> 8) % HAIR.length], skin: SKIN[(h >>> 12) % SKIN.length] };
}

/** 말풍선용으로 제목을 줄인다. 글자 단위(한글·이모지 포함)로 세어 중간에 깨지지 않게 한다. */
export function shorten(title: string, max = BUBBLE_CHARS): string {
  const chars = [...title.replace(/\s+/g, " ").trim()];
  return chars.length <= max ? chars.join("") : `${chars.slice(0, max - 1).join("")}…`;
}

/** 최신 글 목록 → 손님 목록. 목록은 최신순이라고 보고, 처음 나온 글이 그 사람의 최신 글이다. */
export function visitorsFrom(posts: PostSummary[], max = MAX_VISITORS, now = Date.now(), chars = BUBBLE_CHARS): Visitor[] {
  const byAuthor = new Map<string, Visitor>();
  for (const post of posts) {
    const author = post.author.trim() || "익명";
    const known = byAuthor.get(author);
    if (known) { known.posts += 1; continue; }
    if (byAuthor.size >= max) continue;
    byAuthor.set(author, {
      author, postId: post.id, title: post.title, short: shorten(post.title, chars), category: post.category,
      comments: post.comment_count, createdAt: post.created_at, fresh: isFresh(post.created_at, now), example: !!post.example, posts: 1, outfit: outfitOf(author),
    });
  }
  return [...byAuthor.values()];
}

/** 말풍선 폭 어림. 영문·숫자는 반 칸, 그 밖(한글 등)은 한 칸으로 센다. */
export function bubbleWidth(text: string, fontSize: number): number {
  return [...text].reduce((w, ch) => w + (/[\x20-\x7e]/.test(ch) ? 0.6 : 1) * fontSize, 0);
}
