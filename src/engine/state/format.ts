/** 출력 형식을 실제 리눅스 명령과 비슷하게 맞추는 도우미들 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** "Sep 11 09:02:11" — ls -l, journalctl이 쓰는 형식 */
export function formatLogTime(epochMs: number): string {
  const d = new Date(epochMs);
  return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, " ")} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** "Fri 2026-09-11 09:02:11 UTC" — systemctl status가 쓰는 형식 */
export function formatFullTime(epochMs: number): string {
  const d = new Date(epochMs);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return `${days[d.getUTCDay()]} ${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}

/** "5min 12s ago" 같은 경과 시간 */
export function formatAgo(fromMs: number, nowMs: number): string {
  const sec = Math.max(0, Math.floor((nowMs - fromMs) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min ${sec % 60}s ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}h ${min % 60}min ago`;
  return `${Math.floor(hour / 24)} days ago`;
}

/** KB 단위 숫자를 df -h / du -h 처럼 "7.4G", "512M" 으로 */
export function humanKB(kb: number): string {
  if (kb < 1) return "0";
  if (kb < 1024) return `${Math.round(kb)}K`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)}M`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)}G`;
}

/** 여러 줄을 열 맞춰 출력한다. align이 "right"면 오른쪽 정렬. */
export function table(rows: string[][], align: ("left" | "right")[]): string {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => (r[col] ?? "").length)));
  return rows
    .map((row) =>
      row
        .map((cell, col) =>
          align[col] === "right" ? cell.padStart(widths[col]) : cell.padEnd(widths[col]),
        )
        .join(" ")
        .trimEnd(),
    )
    .join("\n");
}
