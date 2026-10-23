import { formatAnswer, parseInline, type Inline } from "../answerFormat";
import "../rich-answer.css";

function Parts({ parts }: { parts: Inline[] }) {
  return <>{parts.map((part, index) => part.kind === "code" ? <code key={index}>{part.text}</code>
    : part.kind === "cite" ? <span key={index} className="cite-chip">{part.text}</span>
    : <span key={index}>{part.text}</span>)}</>;
}

/** 한 줄짜리 문장(제안 점검 등)의 `코드`와 출처 표시만 꾸민다. */
export function RichLine({ text }: { text: string }) {
  return <span className="rich-line"><Parts parts={parseInline(text)} /></span>;
}

/** 코치 답변 본문. 제목·목록·문단을 나눠 보여 준다. */
export function RichAnswer({ text }: { text: string }) {
  const blocks = formatAnswer(text);
  return <div className="rich-answer">
    {blocks.map((block, index) => block.kind === "heading" ? <h5 key={index}><Parts parts={block.parts} /></h5>
      : block.kind === "bullet" ? <p key={index} className="rich-bullet"><Parts parts={block.parts} /></p>
      : <p key={index}><Parts parts={block.parts} /></p>)}
  </div>;
}
