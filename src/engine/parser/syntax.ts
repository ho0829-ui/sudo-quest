/** 실행 전 한 줄 전체를 검사한다. 불완전한 입력의 앞부분만 실행하면 뜻하지 않은 변경이 생긴다. */
export function syntaxError(input: string): string | undefined {
  let quote: string | undefined;
  for (const char of input) {
    if (quote) {
      if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"') { quote = char; continue; }
    // &&·;·백그라운드·명령 치환·입력 리다이렉션은 아직 모델링하지 않은 셸 기능이다.
    if ([";", "&", "`", "<", "(", ")", "\n", "\r"].includes(char)) {
      return `bash: syntax error near unexpected token \`${char.trim() || "newline"}'`;
    }
  }
  if (quote) return `bash: unexpected EOF while looking for matching \`${quote}'`;
  return undefined;
}
