import type { CSSProperties } from 'react';

const paths = {
  home: 'M3 11l9-8 9 8 M5 9.5V21h14V9.5 M10 21v-6h4v6',
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  server: 'M4 3h16v7H4z M4 14h16v7H4z M7 6h.01 M7 17h.01 M11 6h6 M11 17h6',
  book: 'M12 5v16 M12 5C8 2 4 3 2 4v15c4-2 7-1 10 2 3-3 6-4 10-2V4c-2-1-6-2-10 1Z',
  chart: 'M4 3v18h17 M8 16v-5 M13 16V7 M18 16V4',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  search: 'M21 21l-6-6 M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  network: 'M9 2h6v6H9z M2 16h6v6H2z M16 16h6v6h-6z M12 8v4 M5 16v-4h14v4',
  cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 0 11H6Z',
  terminal: 'm4 6 6 6-6 6 M13 18h7',
  check: 'm5 12 4 4L19 6',
  shield: 'm12 2 8 3v6c0 5-4 9-8 11-4-2-8-6-8-11V5l8-3Z m-4 10 3 3 5-6',
  pulse: 'M2 12h5l3-8 4 16 3-8h5',
  clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  pause: 'M8 5v14 M16 5v14',
  play: 'm8 4 12 8-12 8V4Z',
  container: 'M3 7h18v12H3z M3 7l3-3h12l3 3 M7.5 10v6 M12 10v6 M16.5 10v6',
  helm: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17 M12 9.6a2.4 2.4 0 1 1 0 4.8 2.4 2.4 0 0 1 0-4.8 M12 9.6V1 M13.9 10.5l6.7-5.4 M14.3 12.5l8.4 1.9 M13 14.2l3.8 7.7 M11 14.2l-3.8 7.7 M9.7 12.5l-8.4 1.9 M10.1 10.5L3.4 5.1',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, style }: { name: IconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={paths[name]} /></svg>;
}
