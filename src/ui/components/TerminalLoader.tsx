import type { CSSProperties } from 'react';
import './terminal-loader.css';

// 영상의 도트 실루엣처럼 작은 점들이 모여 창과 프롬프트를 만든다.
// 실제 로딩 중에만 마운트한다. 애니메이션을 보여 주려고 요청을 늦추지 않는다.
const PIXELS = [
  '111111111111111',
  '100000000000001',
  '101010000000001',
  '111111111111111',
  '100000000000001',
  '100100000000001',
  '100010000000001',
  '100100011110001',
  '100000000000001',
  '111111111111111',
];

export function TerminalLoader({ label = '불러오는 중…', compact = false }: { label?: string; compact?: boolean }) {
  return <span className={`terminal-loader${compact ? ' compact' : ''}`} role="status" aria-live="polite">
    <svg viewBox="0 0 72 52" aria-hidden="true" focusable="false">
      {PIXELS.flatMap((line, y) => [...line].flatMap((pixel, x) => pixel === '1' ? <circle key={`${x}-${y}`} cx={8 + x * 4} cy={8 + y * 4} r="1.35"
        className={y > 3 && x > 1 && x < 13 ? 'cli-ink' : 'cli-frame'}
        style={{ '--delay': `${(x + y) * -0.035}s`, '--drift': `${(x % 3 - 1) * 4}px` } as CSSProperties} /> : []))}
      <rect className="cli-cursor" x="56" y="29" width="3" height="6" rx=".6" />
    </svg><span>{label}</span>
  </span>;
}
