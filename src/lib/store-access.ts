import type { Employee, Role } from "./types";
import type { SharedState } from "./server-db";

/** Strip credential material before any client response. */
export function redactState(state: SharedState): SharedState {
  return {
    ...state,
    employees: state.employees.map((e) => ({ ...e, password: "" })),
  };
}

function publicEmployeeView(e: Employee, selfId: string): Employee {
  if (e.id === selfId) return { ...e, password: "" };
  return {
    ...e,
    password: "",
    email: "",
    registeredAt: undefined,
    reviewedAt: undefined,
    reviewedBy: undefined,
  };
}

/**
 * Role-scoped read filter. Admins see the full tenant (passwords stripped).
 * Managers see operational data needed for review/team views.
 * Employees only see their own records + groups they belong to.
 */
export function filterStateForReader(
  state: SharedState,
  actor: Employee,
): SharedState {
  const base = redactState(state);

  if (actor.role === "admin") {
    return base;
  }

  if (actor.role === "manager") {
    return {
      ...base,
      backups: [],
      auditLogs: base.auditLogs
        .filter((a) => a.actorId === actor.id)
        .slice(0, 200),
      notifications: base.notifications.filter((n) => n.userId === actor.id),
      // Screenshots: only own (managers don't get company-wide capture feed)
      screenshots: base.screenshots.filter((s) => s.employeeId === actor.id),
      meetingGroups: base.meetingGroups.filter(
        (g) => g.memberIds.includes(actor.id) || g.createdBy === actor.id,
      ),
      meetings: base.meetings.filter(
        (m) =>
          m.participantIds.includes(actor.id) || m.createdBy === actor.id,
      ),
      chatMessages: base.chatMessages.filter((m) => {
        const group = base.meetingGroups.find((g) => g.id === m.groupId);
        return Boolean(group?.memberIds.includes(actor.id));
      }),
    };
  }

  // employee
  const myGroupIds = new Set(
    base.meetingGroups
      .filter((g) => g.memberIds.includes(actor.id))
      .map((g) => g.id),
  );
  const visiblePeople = new Set<string>([actor.id]);
  for (const g of base.meetingGroups) {
    if (!myGroupIds.has(g.id)) continue;
    for (const id of g.memberIds) visiblePeople.add(id);
  }
  for (const t of base.tasks) {
    if (t.assigneeId === actor.id) visiblePeople.add(t.ownerId);
  }

  return {
    ...base,
    employees: base.employees
      .filter((e) => visiblePeople.has(e.id))
      .map((e) => publicEmployeeView(e, actor.id)),
    sessions: base.sessions.filter((s) => s.employeeId === actor.id),
    timeEvents: base.timeEvents.filter((e) => e.employeeId === actor.id),
    tasks: base.tasks.filter((t) => t.assigneeId === actor.id),
    submissions: base.submissions.filter((s) => s.employeeId === actor.id),
    screenshots: base.screenshots.filter((s) => s.employeeId === actor.id),
    reports: base.reports.filter((r) => r.employeeId === actor.id),
    backups: [],
    auditLogs: base.auditLogs
      .filter((a) => a.actorId === actor.id)
      .slice(0, 50),
    meetingGroups: base.meetingGroups.filter((g) => myGroupIds.has(g.id)),
    meetings: base.meetings.filter((m) =>
      m.participantIds.includes(actor.id),
    ),
    notifications: base.notifications.filter((n) => n.userId === actor.id),
    chatMessages: base.chatMessages.filter((m) => myGroupIds.has(m.groupId)),
    policy: base.policy,
  };
}

/** Only allow http(s) meeting / submission links. */
export function sanitizeHttpUrl(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return undefined;
    return u.toString();
  } catch {
    return undefined;
  }
}

export function hasActiveAdmin(state: SharedState): boolean {
  return state.employees.some((e) => e.role === "admin" && e.status === "active");
}

export function findActor(
  state: SharedState,
  userId: string,
): Employee | null {
  const actor = state.employees.find((e) => e.id === userId) ?? null;
  if (!actor || actor.status !== "active") return null;
  return actor;
}

function mergeOwned<T extends { id: string; employeeId: string }>(
  current: T[],
  incoming: T[],
  actorId: string,
): T[] {
  const others = current.filter((x) => x.employeeId !== actorId);
  const mine = incoming.filter((x) => x.employeeId === actorId);
  return [...mine, ...others];
}

function mergeTasks(
  current: SharedState["tasks"],
  incoming: SharedState["tasks"],
  actor: Employee,
): SharedState["tasks"] {
  if (actor.role === "admin" || actor.role === "manager") {
    const currentIds = new Set(current.map((t) => t.id));
    const kept = incoming.filter(
      (t) => currentIds.has(t.id) || actor.role === "admin" || actor.role === "manager",
    );
    // Allow creates from managers/admins; drop unknown orphans already covered
    return kept.length ? kept : current;
  }
  return current.map((t) => {
    if (t.assigneeId !== actor.id) return t;
    const next = incoming.find((i) => i.id === t.id);
    if (!next) return t;
    return { ...t, status: next.status };
  });
}

function mergeSubmissions(
  current: SharedState["submissions"],
  incoming: SharedState["submissions"],
  actor: Employee,
): SharedState["submissions"] {
  if (actor.role === "admin" || actor.role === "manager") {
    return incoming;
  }
  const others = current.filter((s) => s.employeeId !== actor.id);
  const mine = incoming.filter((s) => s.employeeId === actor.id);
  return [...mine, ...others];
}

function mergeEmployees(
  current: SharedState["employees"],
  incoming: SharedState["employees"],
  actor: Employee,
): SharedState["employees"] {
  if (actor.role === "admin") {
    return current.map((cur) => {
      const next = incoming.find((e) => e.id === cur.id);
      if (!next) return cur;
      return {
        ...cur,
        name: next.name,
        role: next.role,
        team: next.team,
        status: next.status,
        presence: next.presence,
        lastSeenAt: next.lastSeenAt,
        reviewedAt: next.reviewedAt,
        reviewedBy: next.reviewedBy,
        // password + email never taken from client
      };
    });
  }

  return current.map((cur) => {
    if (cur.id !== actor.id) return cur;
    const next = incoming.find((e) => e.id === cur.id);
    if (!next) return cur;
    return {
      ...cur,
      presence: next.presence,
      lastSeenAt: next.lastSeenAt,
    };
  });
}

function sanitizeStateUrls(state: SharedState): SharedState {
  return {
    ...state,
    meetings: (state.meetings ?? []).map((m) => ({
      ...m,
      meetingLink: sanitizeHttpUrl(m.meetingLink) ?? undefined,
    })),
    submissions: (state.submissions ?? []).map((s) => ({
      ...s,
      links: (s.links ?? [])
        .map((l) => sanitizeHttpUrl(l))
        .filter((l): l is string => Boolean(l)),
    })),
    notifications: (state.notifications ?? []).map((n) => ({
      ...n,
      link: sanitizeHttpUrl(n.link) ?? undefined,
    })),
  };
}

/**
 * Apply a client store write under the caller's role.
 * Passwords are never accepted from the client.
 * Non-admins cannot change policy, wipe audits, or escalate roles.
 */
export function applyAuthorizedWrite(
  current: SharedState,
  incoming: SharedState,
  actor: Employee,
): SharedState {
  if (actor.role === "admin") {
    return sanitizeStateUrls({
      ...incoming,
      employees: mergeEmployees(current.employees, incoming.employees, actor),
      policy: incoming.policy ?? current.policy,
    });
  }

  const memberGroupIds = new Set(
    (current.meetingGroups ?? [])
      .filter((g) => g.memberIds.includes(actor.id))
      .map((g) => g.id),
  );

  const mergeNotifications = () => {
    const others = (current.notifications ?? []).filter(
      (n) => n.userId !== actor.id,
    );
    const mine = (incoming.notifications ?? []).filter(
      (n) => n.userId === actor.id,
    );
    return [...mine, ...others].slice(0, 3000);
  };

  const mergeChat = () => {
    const currentMsgs = current.chatMessages ?? [];
    const incomingMsgs = incoming.chatMessages ?? [];
    const preserved = currentMsgs.filter(
      (m) => !memberGroupIds.has(m.groupId),
    );
    const allowedIncoming = incomingMsgs.filter(
      (m) =>
        memberGroupIds.has(m.groupId) &&
        (m.authorId === actor.id ||
          currentMsgs.some((c) => c.id === m.id)),
    );
    // Keep existing messages in member groups + new messages authored by actor
    const inGroups = currentMsgs.filter((m) => memberGroupIds.has(m.groupId));
    const byId = new Map(inGroups.map((m) => [m.id, m]));
    for (const m of allowedIncoming) {
      if (!byId.has(m.id) && m.authorId === actor.id) byId.set(m.id, m);
      else if (byId.has(m.id)) byId.set(m.id, byId.get(m.id)!);
    }
    // Also accept brand-new own messages from incoming
    for (const m of incomingMsgs) {
      if (
        memberGroupIds.has(m.groupId) &&
        m.authorId === actor.id &&
        !byId.has(m.id)
      ) {
        byId.set(m.id, m);
      }
    }
    return [...preserved, ...byId.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(-5000);
  };

  if (actor.role === "manager") {
    return sanitizeStateUrls({
      ...current,
      employees: mergeEmployees(current.employees, incoming.employees, actor),
      tasks: mergeTasks(current.tasks, incoming.tasks, actor),
      submissions: mergeSubmissions(
        current.submissions,
        incoming.submissions,
        actor,
      ),
      sessions: mergeOwned(current.sessions, incoming.sessions, actor.id),
      timeEvents: mergeOwned(current.timeEvents, incoming.timeEvents, actor.id),
      reports: incoming.reports ?? current.reports,
      screenshots: mergeOwned(
        current.screenshots,
        incoming.screenshots,
        actor.id,
      ),
      auditLogs: [
        ...incoming.auditLogs.filter((a) => a.actorId === actor.id).slice(0, 50),
        ...current.auditLogs,
      ].slice(0, 2000),
      backups: current.backups,
      meetingGroups: current.meetingGroups ?? [],
      meetings: current.meetings ?? [],
      notifications: mergeNotifications(),
      chatMessages: mergeChat(),
      policy: current.policy,
    });
  }

  // employee
  return sanitizeStateUrls({
    ...current,
    employees: mergeEmployees(current.employees, incoming.employees, actor),
    tasks: mergeTasks(current.tasks, incoming.tasks, actor),
    submissions: mergeSubmissions(
      current.submissions,
      incoming.submissions,
      actor,
    ),
    sessions: mergeOwned(current.sessions, incoming.sessions, actor.id),
    timeEvents: mergeOwned(current.timeEvents, incoming.timeEvents, actor.id),
    reports: current.reports,
    screenshots: mergeOwned(
      current.screenshots,
      incoming.screenshots,
      actor.id,
    ),
    auditLogs: [
      ...incoming.auditLogs.filter((a) => a.actorId === actor.id).slice(0, 20),
      ...current.auditLogs,
    ].slice(0, 2000),
    backups: current.backups,
    meetingGroups: current.meetingGroups ?? [],
    meetings: current.meetings ?? [],
    notifications: mergeNotifications(),
    chatMessages: mergeChat(),
    policy: current.policy,
  });
}

export function requireRole(
  actor: Employee,
  roles: Role[],
): boolean {
  return roles.includes(actor.role);
}
