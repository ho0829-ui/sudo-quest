/** 값을 받지 않는 옵션만 사용하는 명령용. 미구현 옵션을 무시한 채 변경하지 않게 한다. */
export function unknownBooleanOption(tokens: string[], short: string, long: readonly string[] = []): string | undefined {
  return tokens.find(token => {
    if (!token.startsWith("-") || token === "-") return false;
    if (token.startsWith("--")) return !long.includes(token.slice(2));
    return [...token.slice(1)].some(flag => !short.includes(flag));
  });
}
