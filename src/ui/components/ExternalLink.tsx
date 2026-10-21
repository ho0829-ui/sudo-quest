import type { ReactNode } from "react";

/**
 * 공식 문서 같은 바깥 링크. 항상 새 탭으로 열어 실습·대화 화면을 떠나지 않게 한다.
 * noopener로 새 탭이 이 페이지를 조작하지 못하게 막고, 화면 낭독기에 새 탭임을 알린다.
 */
export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return <a className="external-link" href={href} target="_blank" rel="noopener noreferrer">
    {children}<span aria-hidden="true"> ↗</span><span className="visually-hidden"> (새 탭에서 열림)</span>
  </a>;
}
