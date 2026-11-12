import type { TimeEvent } from "./types";

export function minutesBetween(start: string, end?: string): number {
  const endMs = end ? new Date(end).getTime() : Date.now();
  // Keep fractional minutes so short breaks don't round to 0 / keep looking open.
  return Math.max(0, (endMs - new Date(start).getTime()) / 60000);
}

export function formatDuration(minutes: number): string {
  const totalSeconds = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
  return `${s}s`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    timeZone: "Asia/Karachi",
    dateStyle: "medium",
  }).format(new Date(iso));
}

export function sumEventMinutes(
  events: TimeEvent[],
  type: TimeEvent["type"],
): number {
  return events
    .filter((e) => e.type === type)
    .reduce((acc, e) => acc + minutesBetween(e.startTime, e.endTime), 0);
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
