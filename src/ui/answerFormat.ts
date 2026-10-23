/**
 * 코치 답변의 가벼운 Markdown(### 제목, - 목록, `코드`, **강조**)을 화면용 블록으로 나눈다.
 * HTML로 바꿔 끼우지 않고 React 요소로만 그리므로, 답변에 태그가 섞여 있어도 글자로만 보인다.
 */
export type Inline = { kind: "text" | "code" | "cite"; text: string };
export type Block = { kind: "heading" | "bullet" | "para"; parts: Inline[] };

// [실습 기록 N], [근거 N]은 출처 표시라 따로 꾸민다.
const INLINE = /(`[^`\n]+`|\[(?:실습 기록|근거) \d+\])/g;

export function parseInline(line: string): Inline[] {
  const parts: Inline[] = [];
  for (const piece of line.replace(/\*\*(.+?)\*\*/g, "$1").split(INLINE)) {
    if (!piece) continue;
    if (piece.startsWith("`") && piece.endsWith("`") && piece.length > 2) parts.push({ kind: "code", text: piece.slice(1, -1) });
    else if (/^\[(?:실습 기록|근거) \d+\]$/.test(piece)) parts.push({ kind: "cite", text: piece.slice(1, -1) });
    else parts.push({ kind: "text", text: piece });
  }
  return parts;
}

export function formatAnswer(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
    if (heading) blocks.push({ kind: "heading", parts: parseInline(heading[1]) });
    else if (bullet) blocks.push({ kind: "bullet", parts: parseInline(bullet[1]) });
    else blocks.push({ kind: "para", parts: parseInline(line) });
  }
  return blocks;
}
