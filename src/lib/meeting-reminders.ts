import { formatDateTime, uid } from "./time";
import type { AppNotification, Meeting } from "./types";

type StateSlice = {
  meetings: Meeting[];
  notifications: AppNotification[];
};

export function meetingTimeLabel(scheduledAt?: string): string {
  if (!scheduledAt) return "";
  try {
    return formatDateTime(scheduledAt);
  } catch {
    return scheduledAt;
  }
}

export function meetingInviteBody(opts: {
  actorName: string;
  kind: "single" | "group";
  scheduledAt?: string;
}): string {
  const when = meetingTimeLabel(opts.scheduledAt);
  const timeLine = when
    ? ` Scheduled for ${when} (Asia/Karachi). You will get a reminder 15 minutes before.`
    : "";
  if (opts.kind === "group") {
    return `${opts.actorName} sent the group meeting link.${timeLine}`.trim();
  }
  return `${opts.actorName} sent you a meeting link.${timeLine}`.trim();
}

/**
 * Create 15‑minute-before reminders for due meetings.
 * Returns null if nothing changed.
 */
export function applyDueMeetingReminders<T extends StateSlice>(
  state: T,
  nowMs: number = Date.now(),
): T | null {
  const meetings = state.meetings ?? [];
  if (meetings.length === 0) return null;

  let changed = false;
  const newNotes: AppNotification[] = [];
  const nextMeetings = meetings.map((m) => {
    if (!m.scheduledAt || m.reminderSentAt) return m;
    const start = new Date(m.scheduledAt).getTime();
    if (!Number.isFinite(start)) return m;
    const reminderAt = start - 15 * 60 * 1000;
    // Fire from 15 min before until 5 min after start (catch late polls)
    if (nowMs < reminderAt || nowMs > start + 5 * 60 * 1000) return m;

    const when = meetingTimeLabel(m.scheduledAt);
    const nowIso = new Date(nowMs).toISOString();
    for (const userId of m.participantIds) {
      newNotes.push({
        id: uid("ntf"),
        userId,
        type: "meeting_reminder",
        title: `Reminder: ${m.title} starts soon`,
        body: when
          ? `Meeting starts at ${when}. Join now — about 15 minutes left.`
          : "Your meeting starts in about 15 minutes. Join with the link when ready.",
        meetingId: m.id,
        groupId: m.groupId,
        link: m.meetingLink,
        createdAt: nowIso,
      });
    }
    changed = true;
    return { ...m, reminderSentAt: nowIso };
  });

  if (!changed) return null;
  return {
    ...state,
    meetings: nextMeetings,
    notifications: [...newNotes, ...(state.notifications ?? [])].slice(0, 3000),
  };
}

/** datetime-local value (local) → ISO string */
export function localInputToIso(localValue: string): string | undefined {
  if (!localValue.trim()) return undefined;
  const d = new Date(localValue);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

/** ISO → datetime-local value in local timezone for input controls */
export function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
