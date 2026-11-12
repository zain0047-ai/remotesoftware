import { applyDueMeetingReminders } from "./meeting-reminders";
import { normalizePolicy } from "./policy";
import { createSeedState } from "./seed";
import type { AppState, Employee, Session, TimeEvent } from "./types";
import { kvGet, kvPut, kvReset, tenantKey } from "./db";

export type SharedState = Omit<AppState, "currentUserId">;

export type PersistedStore = {
  version: number;
  updatedAt: string;
  tenantId: string;
  state: SharedState;
};

function normalizeEmployees(employees: Employee[]): Employee[] {
  return employees.map((e) => ({
    ...e,
    presence: e.presence === "online" ? "online" : "offline",
  }));
}

/** Close open break/work/idle events whose session already ended. */
function sealOrphanTimeEvents(
  sessions: Session[],
  timeEvents: TimeEvent[],
): TimeEvent[] {
  const closed = new Map(
    sessions
      .filter((s) => Boolean(s.endTime) || s.status === "ended" || s.status === "interrupted")
      .map((s) => [s.id, s.endTime ?? s.startTime]),
  );
  return timeEvents.map((e) => {
    if (e.endTime) return e;
    const sessionEnd = closed.get(e.sessionId);
    if (!sessionEnd) return e;
    return { ...e, endTime: sessionEnd };
  });
}

function toShared(state: AppState | SharedState): SharedState {
  const { currentUserId: _ignored, ...rest } = state as AppState;
  const sessions = rest.sessions ?? [];
  const timeEvents = sealOrphanTimeEvents(sessions, rest.timeEvents ?? []);
  return {
    ...rest,
    policy: normalizePolicy(rest.policy),
    employees: normalizeEmployees(rest.employees ?? []),
    sessions,
    timeEvents,
    tasks: rest.tasks ?? [],
    submissions: rest.submissions ?? [],
    screenshots: rest.screenshots ?? [],
    reports: rest.reports ?? [],
    backups: rest.backups ?? [],
    auditLogs: rest.auditLogs ?? [],
    meetingGroups: rest.meetingGroups ?? [],
    meetings: rest.meetings ?? [],
    notifications: rest.notifications ?? [],
    chatMessages: rest.chatMessages ?? [],
  };
}

/** Load (and lazily create) a tenant's store document. */
async function ensureTenantStore(tenantId: string): Promise<PersistedStore> {
  if (!tenantId) throw new Error("tenantId required");
  const row = await kvGet(tenantKey(tenantId));
  if (!row) {
    const seed = toShared(createSeedState());
    const saved = await kvReset(tenantKey(tenantId), seed);
    return {
      version: saved.version,
      updatedAt: saved.updatedAt,
      tenantId,
      state: seed,
    };
  }
  return {
    version: row.version,
    updatedAt: row.updatedAt,
    tenantId,
    state: row.data as SharedState,
  };
}

export async function readStore(tenantId: string): Promise<PersistedStore> {
  const store = await ensureTenantStore(tenantId);
  let sealed = toShared(store.state);
  const orphanChanged =
    JSON.stringify(sealed.timeEvents) !== JSON.stringify(store.state.timeEvents);
  const withReminders = applyDueMeetingReminders(sealed);
  if (withReminders) sealed = withReminders;
  if (orphanChanged || withReminders) {
    const saved = await kvPut(tenantKey(tenantId), sealed);
    return {
      version: saved?.version ?? store.version,
      updatedAt: saved?.updatedAt ?? store.updatedAt,
      tenantId,
      state: sealed,
    };
  }
  return { ...store, tenantId, state: sealed };
}

export async function writeStore(
  tenantId: string,
  state: SharedState,
  expectedVersion?: number,
): Promise<PersistedStore> {
  const shared = toShared(state);
  const saved = await kvPut(tenantKey(tenantId), shared, expectedVersion);
  if (!saved) {
    // Version conflict: hand the caller the current store so it can merge.
    const current = await ensureTenantStore(tenantId);
    const err = new Error("VERSION_CONFLICT") as Error & {
      code: string;
      store: PersistedStore;
    };
    err.code = "VERSION_CONFLICT";
    err.store = current;
    throw err;
  }
  return {
    version: saved.version,
    updatedAt: saved.updatedAt,
    tenantId,
    state: shared,
  };
}

export async function resetStore(tenantId: string): Promise<PersistedStore> {
  const seed = toShared(createSeedState());
  const saved = await kvReset(tenantKey(tenantId), seed);
  return {
    version: saved.version,
    updatedAt: saved.updatedAt,
    tenantId,
    state: seed,
  };
}

/** Count active employees for seat limits (excludes rejected/inactive). */
export async function countActiveSeats(tenantId: string): Promise<number> {
  try {
    const store = await readStore(tenantId);
    return store.state.employees.filter(
      (e) => e.status === "active" || e.status === "pending",
    ).length;
  } catch {
    return 0;
  }
}
