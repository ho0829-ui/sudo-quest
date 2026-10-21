/**
 * 게시글 본문 서식. 명령어·로그를 나누는 곳이라 ``` 코드 블록과 `한 줄 코드`만 알아본다.
 * 결과는 문자열 조각 목록이고 화면은 React 요소로만 그린다(HTML로 해석하지 않으므로 스크립트가 끼어들 수 없다).
 */
export type PostInline = { kind: "text" | "code"; text: string };
export type PostBlock =
  | { kind: "code"; lang: string; text: string }
  | { kind: "text"; parts: PostInline[] };

const FENCE = /^```\s*([\w+-]{0,20})\s*$/;

/** 한 줄 안의 `코드`. 짝이 맞지 않는 백틱은 글자 그대로 둔다. */
export function parsePostInline(line: string): PostInline[] {
  const parts: PostInline[] = [];
  const pattern = /`([^`\n]+)`/g;
  let last = 0;
  for (let match = pattern.exec(line); match; match = pattern.exec(line)) {
    if (match.index > last) parts.push({ kind: "text", text: line.slice(last, match.index) });
    parts.push({ kind: "code", text: match[1] });
    last = match.index + match[0].length;
  }
  if (last < line.length) parts.push({ kind: "text", text: line.slice(last) });
  return parts;
}

export function parsePostBody(body: string): PostBlock[] {
  const blocks: PostBlock[] = [];
  const lines = body.replace(/\r\n?/g, "\n").split("\n");
  let text: string[] = [];
  const flushText = () => {
    const joined = text.join("\n").replace(/^\n+|\n+$/g, "");
    if (joined) blocks.push({ kind: "text", parts: parsePostInline(joined) });
    text = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE.exec(lines[i]);
    if (!open) { text.push(lines[i]); continue; }
    // 닫는 ```이 없으면 코드 블록으로 보지 않고 글자 그대로 둔다(작성 중인 글이 깨져 보이지 않게).
    const close = lines.findIndex((line, j) => j > i && /^```\s*$/.test(line));
    if (close < 0) { text.push(lines[i]); continue; }
    flushText();
    blocks.push({ kind: "code", lang: open[1], text: lines.slice(i + 1, close).join("\n") });
    i = close;
  }
  flushText();
  return blocks;
}

/** 목록 미리보기용 한 덩어리 글. ``` 줄과 백틱 표시는 빼고 내용만 남긴다. */
export function plainExcerpt(text: string): string {
  return text.replace(/^```[\w+-]*\s*$/gm, "").replace(/`([^`\n]+)`/g, "$1").replace(/\n{2,}/g, "\n").trim();
}

/** 실습 리포트에서 "회고 남기기"를 누르면 채워 둘 초안. 공개된 실습 번호·제목만 쓴다. */
export function missionDraft(no: number, title: string) {
  return {
    title: `[MISSION ${String(no).padStart(2, "0")} 회고] ${title}`.slice(0, 100),
    body: "[증상]\n\n\n[확인한 명령]\n```\n\n```\n\n[원인과 조치]\n\n\n[다음에 먼저 볼 것]\n",
    category: "review" as const,
    spoiler: true,
  };
}
