import { termsIn } from "../glossary";

/**
 * 연 힌트 아래 "용어 풀이" 펼침. before(앞 단계 힌트들)에서 이미 풀이한 용어는 되풀이하지 않는다.
 * 힌트 글에 새 용어가 없으면 아무것도 그리지 않는다.
 */
export function HintGlossary({ text, before = "" }: { text: string; before?: string }) {
  const terms = termsIn(text).filter(entry => !entry.pattern.test(before));
  if (terms.length === 0) return null;
  return <details className="hint-glossary">
    <summary>용어 풀이 · {terms.map(t => t.term).join(", ")}</summary>
    <dl>{terms.map(t => <div key={t.term}><dt>{t.term}</dt><dd>{t.plain}</dd></div>)}</dl>
  </details>;
}
