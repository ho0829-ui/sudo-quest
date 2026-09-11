import type { LogEntry, LogPriority, SystemState } from "./types";

/** 로그를 남긴다. 시각은 시뮬레이션 시계를 따른다. */
export function addLog(
  state: SystemState,
  entry: { tag: string; message: string; unit?: string; priority?: LogPriority; pid?: number },
): void {
  state.journal.push({
    time: state.clock,
    tag: entry.tag,
    unit: entry.unit,
    pid: entry.pid,
    priority: entry.priority ?? "info",
    message: entry.message,
  });
}

/** journalctl 한 줄 형식: "Sep 11 09:02:11 web-01 nginx[1234]: message" */
export function formatJournalLine(entry: LogEntry, hostname: string, time: string): string {
  const tag = entry.pid ? `${entry.tag}[${entry.pid}]` : entry.tag;
  return `${time} ${hostname} ${tag}: ${entry.message}`;
}
