"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { normalizePolicy } from "./policy";
import { createSeedState } from "./seed";
import { minutesBetween, uid } from "./time";
import type {
  AppState,
  Employee,
  MonitoringPolicy,
  Report,
  ReportKind,
  ReportPeriod,
  ReviewStatus,
  Session,
  Submission,
  Task,
  TimeEvent,
  Meeting,
  MeetingGroup,
  MeetingKind,
  AppNotification,
  ChatMessage,
} from "./types";
import { meetingInviteBody } from "./meeting-reminders";

function normalizeShared(shared: SharedState): SharedState {
  return {
    ...shared,
    policy: normalizePolicy(
      shared.policy as MonitoringPolicy & { idleThresholdMinutes?: number },
    ),
    meetingGroups: shared.meetingGroups ?? [],
    meetings: shared.meetings ?? [],
    notifications: shared.notifications ?? [],
    chatMessages: shared.chatMessages ?? [],
  };
}

type SharedState = Omit<AppState, "currentUserId">;

function stripSession(state: AppState): SharedState {
  const { currentUserId: _id, ...rest } = state;
  return rest;
}

function withSession(shared: SharedState, currentUserId: string | null): AppState {
  return { ...shared, currentUserId };
}

type StoreEnvelope = {
  authenticated?: boolean;
  needsAdminSetup?: boolean;
  needsPlatformSetup?: boolean;
  kind?: "tenant" | "super_admin" | null;
  version: number;
  state: SharedState | null;
  currentUserId?: string | null;
  company?: {
    id: string;
    name: string;
    slug: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: string;
  } | null;
};

type StoreApi = {
  ready: boolean;
  state: AppState;
  currentUser: Employee | null;
  activeSession: Session | null;
  login: (
    email: string,
    password: string,
    portal?: "admin" | "employee" | "super",
    companySlug?: string,
  ) => Promise<{ ok: boolean; error?: string; kind?: "tenant" | "super_admin" }>;
  register: (input: {
    name: string;
    email: string;
    password: string;
    team?: string;
    companySlug: string;
  }) => Promise<{ ok: boolean; error?: string; pending?: boolean }>;
  /** Additional admins — pending until an active admin approves */
  registerAdmin: (input: {
    name: string;
    email: string;
    password: string;
    team?: string;
    companySlug: string;
  }) => Promise<{ ok: boolean; error?: string; pending?: boolean }>;
  /** First Super Admin — requires SETUP_SECRET */
  bootstrapAdmin: (input: {
    name: string;
    email: string;
    password: string;
    setupSecret: string;
  }) => Promise<{ ok: boolean; error?: string; kind?: "super_admin" }>;
  company: {
    id: string;
    name: string;
    slug: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: string;
  } | null;
  needsPlatformSetup: boolean;
  sessionKind: "tenant" | "super_admin" | null;
  reviewRegistration: (
    employeeId: string,
    decision: "approve" | "reject",
  ) => { ok: boolean; error?: string };
  logout: () => void;
  needsAdminSetup: boolean;
  pendingRegistrations: () => Employee[];
  startSession: () => void;
  acknowledgeMonitoring: () => void;
  endSession: (reason?: string) => void;
  startBreak: (note?: string) => void;
  resumeWork: () => void;
  markLowInput: (note?: string) => void;
  resolveIdle: (choice: "break" | "work" | "low_input", note?: string) => void;
  /** `inactiveSince` ISO timestamp when pointer/keyboard activity last happened */
  triggerIdleWarning: (inactiveSince?: string) => void;
  /** End session + sign out after inactivity countdown expires */
  forceIdleLogout: () => void;
  submitProgress: (input: {
    taskId: string;
    notes: string;
    links: string[];
  }) => void;
  reviewSubmission: (
    submissionId: string,
    status: Exclude<ReviewStatus, "pending">,
    feedback: string,
  ) => void;
  createTask: (
    task: Omit<Task, "id" | "status">,
    initialStatus?: Task["status"],
  ) => string | null;
  updateTaskStatus: (taskId: string, status: Task["status"]) => void;
  updateTaskAssignee: (taskId: string, assigneeId: string) => void;
  createMeetingGroup: (input: {
    name: string;
    memberIds: string[];
  }) => string | null;
  updateMeetingGroupMembers: (groupId: string, memberIds: string[]) => void;
  createMeeting: (input: {
    kind: MeetingKind;
    title: string;
    participantIds: string[];
    groupId?: string;
    meetingLink?: string;
    scheduledAt?: string;
    notes?: string;
    sendNow?: boolean;
  }) => string | null;
  updateMeetingLink: (meetingId: string, meetingLink: string) => void;
  sendMeetingLink: (
    meetingId: string,
    opts?: { scheduledAt?: string },
  ) => { ok: boolean; error?: string };
  sendGroupChat: (
    groupId: string,
    body: string,
  ) => { ok: boolean; error?: string };
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  updatePolicy: (patch: Partial<MonitoringPolicy>) => void;
  generateDailyReport: (employeeId: string) => Report | null;
  generateEmployeeReport: (
    employeeId: string,
    period: ReportPeriod,
    customRange?: { start: string; end: string },
  ) => Report | null;
  runBackup: () => void;
  /** Manual backup: logs job + returns downloadable JSON payload */
  runManualBackup: () => { ok: boolean; filename: string; json: string } | null;
  disputeTimeEvent: (eventId: string, note: string) => void;
  resetDemo: () => void;
  refreshFromServer: () => Promise<void>;
  employeeTasks: (employeeId: string) => Task[];
  pendingSubmissions: () => Submission[];
  teamEmployees: () => Employee[];
};

const StoreContext = createContext<StoreApi | null>(null);

function audit(
  state: AppState,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  outcome: "success" | "denied" | "failure" = "success",
): AppState {
  return {
    ...state,
    auditLogs: [
      {
        id: uid("aud"),
        actorId,
        action,
        targetType,
        targetId,
        timestamp: new Date().toISOString(),
        outcome,
      },
      ...state.auditLogs,
    ],
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(createSeedState);
  const [ready, setReady] = useState(false);
  const [needsAdminSetupFlag, setNeedsAdminSetupFlag] = useState(false);
  const [needsPlatformSetup, setNeedsPlatformSetup] = useState(false);
  const [sessionKind, setSessionKind] = useState<"tenant" | "super_admin" | null>(
    null,
  );
  const [company, setCompany] = useState<{
    id: string;
    name: string;
    slug: string;
    subscriptionStatus?: string;
    subscriptionExpiresAt?: string;
  } | null>(null);
  const versionRef = useRef(0);
  const skipNextPush = useRef(false);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const authenticatedRef = useRef(false);

  const applyShared = useCallback(
    (shared: SharedState, version: number, currentUserId?: string | null) => {
      versionRef.current = version;
      skipNextPush.current = true;
      const normalized = normalizeShared(shared);
      setState((prev) =>
        withSession(
          normalized,
          currentUserId === undefined ? prev.currentUserId : currentUserId,
        ),
      );
    },
    [],
  );

  const pushShared = useCallback(
    async (shared: SharedState) => {
      if (!authenticatedRef.current) return;
      try {
        const res = await fetch("/api/store", {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: shared, version: versionRef.current }),
        });
        if (res.status === 401) {
          authenticatedRef.current = false;
          skipNextPush.current = true;
          setState(withSession(stripSession(createSeedState()), null));
          return;
        }
        if (res.status === 409) {
          const conflict = (await res.json()) as {
            store?: { version: number; state: SharedState };
          };
          if (conflict.store?.state) {
            applyShared(conflict.store.state, conflict.store.version);
          }
          return;
        }
        if (!res.ok) return;
        const saved = (await res.json()) as StoreEnvelope;
        versionRef.current = saved.version;
        if (saved.state) {
          // Keep local optimistic currentUserId; refresh passwords stay blank.
          skipNextPush.current = true;
        }
      } catch {
        // Keep local UI usable if the network blips; next poll/push retries.
      }
    },
    [applyShared],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/store", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) throw new Error("store fetch failed");
        const data = (await res.json()) as StoreEnvelope;
        if (cancelled) return;
        versionRef.current = data.version;
        setNeedsAdminSetupFlag(Boolean(data.needsAdminSetup));
        setNeedsPlatformSetup(Boolean(data.needsPlatformSetup));
        if (data.authenticated && data.kind === "super_admin") {
          authenticatedRef.current = true;
          setSessionKind("super_admin");
          setCompany(null);
          skipNextPush.current = true;
          setState(withSession(stripSession(createSeedState()), data.currentUserId ?? null));
        } else if (data.authenticated && data.state) {
          authenticatedRef.current = true;
          setSessionKind("tenant");
          setCompany(data.company ?? null);
          const normalized = normalizeShared(data.state);
          const currentUserId = data.currentUserId ?? null;
          const now = new Date().toISOString();
          const employees = normalized.employees.map((e) => {
            if (e.id === currentUserId) {
              return { ...e, presence: "online" as const, lastSeenAt: now };
            }
            return {
              ...e,
              presence:
                e.presence === "online" ? ("online" as const) : ("offline" as const),
            };
          });
          skipNextPush.current = Boolean(currentUserId);
          setState(withSession({ ...normalized, employees }, currentUserId));
        } else {
          authenticatedRef.current = false;
          setSessionKind(null);
          setCompany(null);
          skipNextPush.current = true;
          setState(withSession(stripSession(createSeedState()), null));
        }
      } catch {
        if (cancelled) return;
        authenticatedRef.current = false;
        skipNextPush.current = true;
        setState(withSession(stripSession(createSeedState()), null));
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (
      !authenticatedRef.current ||
      !state.currentUserId ||
      sessionKind !== "tenant"
    ) {
      if (skipNextPush.current) skipNextPush.current = false;
      return;
    }
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    const shared = stripSession(state);
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      void pushShared(shared);
    }, 250);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [state, ready, pushShared, sessionKind]);

  // Pull updates from other browsers (admin approvals, new registrations, etc.)
  useEffect(() => {
    if (!ready || sessionKind !== "tenant") return;
    const tick = async () => {
      try {
        const res = await fetch("/api/store", {
          cache: "no-store",
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as StoreEnvelope;
        setNeedsAdminSetupFlag(Boolean(data.needsAdminSetup));
        setNeedsPlatformSetup(Boolean(data.needsPlatformSetup));
        if (!data.authenticated || data.kind !== "tenant" || !data.state) {
          if (authenticatedRef.current && sessionKind === "tenant") {
            authenticatedRef.current = false;
            setSessionKind(null);
            setCompany(null);
            skipNextPush.current = true;
            setState(withSession(stripSession(createSeedState()), null));
          }
          return;
        }
        authenticatedRef.current = true;
        setCompany(data.company ?? null);
        if (data.version > versionRef.current) {
          applyShared(data.state, data.version, data.currentUserId ?? null);
        }
      } catch {
        // ignore transient errors
      }
    };
    const id = window.setInterval(tick, 4000);
    const onFocus = () => {
      void tick();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, applyShared, sessionKind]);

  const currentUser = useMemo(() => {
    if (sessionKind === "super_admin") return null;
    return state.employees.find((e) => e.id === state.currentUserId) ?? null;
  }, [state.employees, state.currentUserId, sessionKind]);

  const activeSession = useMemo(() => {
    if (!currentUser) return null;
    return (
      state.sessions.find(
        (s) =>
          s.employeeId === currentUser.id &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      ) ?? null
    );
  }, [state.sessions, currentUser]);

  const login = useCallback(
    async (
      email: string,
      password: string,
      portal?: "admin" | "employee" | "super",
      companySlug?: string,
    ) => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, portal, companySlug }),
        });
        const data = (await res.json()) as StoreEnvelope & {
          ok?: boolean;
          error?: string;
          kind?: "tenant" | "super_admin";
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? "Login failed" };
        }
        authenticatedRef.current = true;
        setNeedsAdminSetupFlag(false);
        setNeedsPlatformSetup(false);
        if (data.kind === "super_admin") {
          setSessionKind("super_admin");
          setCompany(null);
          skipNextPush.current = true;
          setState(withSession(stripSession(createSeedState()), data.currentUserId ?? "sa"));
          return { ok: true, kind: "super_admin" as const };
        }
        if (!data.state) {
          return { ok: false, error: data.error ?? "Login failed" };
        }
        setSessionKind("tenant");
        setCompany(data.company ?? null);
        versionRef.current = data.version;
        skipNextPush.current = true;
        setState(
          withSession(normalizeShared(data.state), data.currentUserId ?? null),
        );
        return { ok: true, kind: "tenant" as const };
      } catch {
        return { ok: false, error: "Could not reach the server. Try again." };
      }
    },
    [],
  );

  const register = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      team?: string;
      companySlug: string;
    }) => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, role: "employee" }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          pending?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? "Registration failed" };
        }
        return { ok: true, pending: true };
      } catch {
        return { ok: false, error: "Could not reach the server. Try again." };
      }
    },
    [],
  );

  const registerAdmin = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      team?: string;
      companySlug: string;
    }) => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, role: "admin" }),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          pending?: boolean;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          return { ok: false, error: data.error ?? "Registration failed" };
        }
        return { ok: true, pending: true };
      } catch {
        return { ok: false, error: "Could not reach the server. Try again." };
      }
    },
    [],
  );

  const bootstrapAdmin = useCallback(
    async (input: {
      name: string;
      email: string;
      password: string;
      setupSecret: string;
    }) => {
      try {
        const res = await fetch("/api/auth/bootstrap", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = (await res.json()) as {
          ok?: boolean;
          error?: string;
          kind?: string;
          user?: { id: string };
        };
        if (!res.ok || !data.ok) {
          return {
            ok: false,
            error: data.error ?? "Could not create Super Admin",
          };
        }
        authenticatedRef.current = true;
        setNeedsPlatformSetup(false);
        setNeedsAdminSetupFlag(false);
        setSessionKind("super_admin");
        setCompany(null);
        skipNextPush.current = true;
        setState(
          withSession(stripSession(createSeedState()), data.user?.id ?? "sa"),
        );
        return { ok: true, kind: "super_admin" as const };
      } catch {
        return { ok: false, error: "Could not reach the server. Try again." };
      }
    },
    [],
  );

  const reviewRegistration = useCallback(
    (employeeId: string, decision: "approve" | "reject") => {
      let error: string | undefined;
      setState((prev) => {
        if (!prev.currentUserId) {
          error = "Not signed in.";
          return prev;
        }
        const admin = prev.employees.find((e) => e.id === prev.currentUserId);
        if (!admin || admin.role !== "admin") {
          error = "Only admins can approve registrations.";
          return audit(
            prev,
            prev.currentUserId,
            `auth.registration_${decision}`,
            "employee",
            employeeId,
            "denied",
          );
        }
        const target = prev.employees.find((e) => e.id === employeeId);
        if (!target || target.status !== "pending") {
          error = "No pending registration found for this user.";
          return prev;
        }
        const now = new Date().toISOString();
        const nextStatus = decision === "approve" ? "active" : "rejected";
        let meetingGroups = prev.meetingGroups ?? [];
        // Newly approved people become available for single + group meetings.
        if (decision === "approve" && target.role !== "admin") {
          meetingGroups = meetingGroups.map((g) =>
            g.memberIds.includes(employeeId)
              ? g
              : { ...g, memberIds: [...g.memberIds, employeeId] },
          );
        }
        const next = {
          ...prev,
          employees: prev.employees.map((e) =>
            e.id === employeeId
              ? {
                  ...e,
                  status: nextStatus as Employee["status"],
                  reviewedAt: now,
                  reviewedBy: admin.id,
                }
              : e,
          ),
          meetingGroups,
        };
        return audit(
          next,
          admin.id,
          decision === "approve"
            ? "auth.registration_approved"
            : "auth.registration_rejected",
          "employee",
          employeeId,
        );
      });
      if (error) return { ok: false, error };
      return { ok: true };
    },
    [],
  );

  const logout = useCallback(() => {
    void (async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // ignore
      }
      authenticatedRef.current = false;
      setSessionKind(null);
      setCompany(null);
      skipNextPush.current = true;
      setState(withSession(stripSession(createSeedState()), null));
      try {
        const res = await fetch("/api/store", {
          cache: "no-store",
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as StoreEnvelope;
          setNeedsAdminSetupFlag(Boolean(data.needsAdminSetup));
          setNeedsPlatformSetup(Boolean(data.needsPlatformSetup));
          versionRef.current = data.version;
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  const startSession = useCallback(() => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const existing = prev.sessions.find(
        (s) =>
          s.employeeId === prev.currentUserId &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      );
      if (existing) return prev;
      const now = new Date().toISOString();
      const sessionId = uid("ses");
      const session: Session = {
        id: sessionId,
        employeeId: prev.currentUserId,
        startTime: now,
        status: "active",
        // No employee-facing monitoring notice — session starts ready.
        monitoringAcknowledged: true,
        noticeShownAt: now,
      };
      const workEvent: TimeEvent = {
        id: uid("te"),
        sessionId,
        employeeId: prev.currentUserId,
        type: "work",
        startTime: now,
        source: "system",
        reviewStatus: "open",
      };
      let next: AppState = {
        ...prev,
        sessions: [session, ...prev.sessions],
        timeEvents: [workEvent, ...prev.timeEvents],
      };
      if (prev.policy.screenshotEnabled) {
        const retention = new Date();
        retention.setDate(retention.getDate() + prev.policy.screenshotRetentionDays);
        next = {
          ...next,
          screenshots: [
            {
              id: uid("ss"),
              sessionId,
              employeeId: prev.currentUserId,
              timestamp: now,
              label: "Simulated session-start evidence frame",
              retentionUntil: retention.toISOString(),
              simulated: true,
              accessLog: [
                {
                  actorId: "system",
                  at: now,
                  action: "simulated_capture",
                },
              ],
            },
            ...prev.screenshots,
          ],
        };
      }
      return audit(next, prev.currentUserId, "session.start", "session", sessionId);
    });
  }, []);

  const acknowledgeMonitoring = useCallback(() => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const open = prev.sessions.find(
        (s) =>
          s.employeeId === prev.currentUserId &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      );
      if (!open) return prev;
      const next = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === open.id ? { ...s, monitoringAcknowledged: true } : s,
        ),
      };
      return audit(
        next,
        prev.currentUserId,
        "session.acknowledge_monitoring",
        "session",
        open.id,
      );
    });
  }, []);

  const endSession = useCallback((reason = "logout") => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const open = prev.sessions.find(
        (s) =>
          s.employeeId === prev.currentUserId &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      );
      if (!open) return prev;
      const now = new Date().toISOString();
      const next = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === open.id
            ? { ...s, status: "ended" as const, endTime: now, endReason: reason }
            : s,
        ),
        timeEvents: prev.timeEvents.map((e) =>
          e.sessionId === open.id && !e.endTime ? { ...e, endTime: now } : e,
        ),
      };
      return audit(next, prev.currentUserId, "session.end", "session", open.id);
    });
  }, []);

  const closeOpenEvents = (events: TimeEvent[], sessionId: string, now: string) =>
    events.map((e) =>
      e.sessionId === sessionId && !e.endTime ? { ...e, endTime: now } : e,
    );

  const startBreak = useCallback((note?: string) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const open = prev.sessions.find(
        (s) => s.employeeId === prev.currentUserId && s.status === "active",
      );
      if (!open) return prev;
      const now = new Date().toISOString();
      const breakEvent: TimeEvent = {
        id: uid("te"),
        sessionId: open.id,
        employeeId: prev.currentUserId,
        type: "break",
        startTime: now,
        source: "employee",
        reviewStatus: "confirmed",
        note,
      };
      const next = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === open.id ? { ...s, status: "on_break" as const } : s,
        ),
        timeEvents: [
          breakEvent,
          ...closeOpenEvents(prev.timeEvents, open.id, now),
        ],
      };
      return audit(next, prev.currentUserId, "session.break_start", "session", open.id);
    });
  }, []);

  const resumeWork = useCallback(() => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const open = prev.sessions.find(
        (s) =>
          s.employeeId === prev.currentUserId &&
          (s.status === "on_break" || s.status === "idle_warning"),
      );
      if (!open) return prev;
      const now = new Date().toISOString();
      const workEvent: TimeEvent = {
        id: uid("te"),
        sessionId: open.id,
        employeeId: prev.currentUserId,
        type: "work",
        startTime: now,
        source: "employee",
        reviewStatus: "confirmed",
      };
      // Explicitly seal break/idle events first so admin duration stops immediately.
      const sealed = prev.timeEvents.map((e) => {
        if (e.sessionId !== open.id || e.endTime) return e;
        if (e.type === "break" || e.type === "idle_signal" || e.type === "work") {
          return {
            ...e,
            endTime: now,
            note:
              e.type === "break"
                ? e.note
                  ? `${e.note} · resumed to active`
                  : "Resumed to active work"
                : e.note,
          };
        }
        return { ...e, endTime: now };
      });
      const next = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === open.id ? { ...s, status: "active" as const } : s,
        ),
        timeEvents: [workEvent, ...sealed],
      };
      return audit(next, prev.currentUserId, "session.resume", "session", open.id);
    });
  }, []);

  const markLowInput = useCallback((note?: string) => {
    setState((prev) => {
      if (!prev.currentUserId || !prev.policy.allowLowInputWork) return prev;
      const open = prev.sessions.find(
        (s) =>
          s.employeeId === prev.currentUserId &&
          (s.status === "active" || s.status === "idle_warning"),
      );
      if (!open) return prev;
      const now = new Date().toISOString();
      const event: TimeEvent = {
        id: uid("te"),
        sessionId: open.id,
        employeeId: prev.currentUserId,
        type: "low_input",
        startTime: now,
        source: "employee",
        reviewStatus: "confirmed",
        note: note ?? "Legitimate low-input work (meeting/reading)",
      };
      const workAfter: TimeEvent = {
        id: uid("te"),
        sessionId: open.id,
        employeeId: prev.currentUserId,
        type: "work",
        startTime: now,
        source: "system",
        reviewStatus: "open",
      };
      // Mark low-input as instantaneous marker then continue work
      event.endTime = now;
      const next = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === open.id ? { ...s, status: "active" as const } : s,
        ),
        timeEvents: [
          workAfter,
          event,
          ...closeOpenEvents(prev.timeEvents, open.id, now),
        ],
      };
      return audit(next, prev.currentUserId, "session.low_input", "session", open.id);
    });
  }, []);

  const triggerIdleWarning = useCallback((inactiveSince?: string) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const open = prev.sessions.find(
        (s) => s.employeeId === prev.currentUserId && s.status === "active",
      );
      if (!open) return prev;
      const now = new Date().toISOString();
      const idleStart = inactiveSince || now;
      const idle: TimeEvent = {
        id: uid("te"),
        sessionId: open.id,
        employeeId: prev.currentUserId,
        type: "idle_signal",
        startTime: idleStart,
        source: "system",
        reviewStatus: "open",
        note: "Inactivity warning started — countdown before auto logout",
      };
      const next = {
        ...prev,
        sessions: prev.sessions.map((s) =>
          s.id === open.id ? { ...s, status: "idle_warning" as const } : s,
        ),
        timeEvents: [idle, ...closeOpenEvents(prev.timeEvents, open.id, now)],
      };
      return audit(next, prev.currentUserId, "session.idle_warning", "session", open.id);
    });
  }, []);

  const forceIdleLogout = useCallback(() => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const userId = prev.currentUserId;
      const now = new Date().toISOString();
      const open = prev.sessions.find(
        (s) =>
          s.employeeId === userId &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      );
      let next: AppState = {
        ...prev,
        // Keep currentUserId briefly so the ended session can still PUT.
        employees: prev.employees.map((e) =>
          e.id === userId
            ? { ...e, presence: "offline" as const, lastSeenAt: now }
            : e,
        ),
      };
      if (open) {
        next = {
          ...next,
          sessions: next.sessions.map((s) =>
            s.id === open.id
              ? {
                  ...s,
                  status: "ended",
                  endTime: now,
                  endReason: "idle_timeout",
                }
              : s,
          ),
          timeEvents: next.timeEvents.map((e) => {
            if (e.sessionId !== open.id || e.endTime) return e;
            if (e.type === "idle_signal") {
              return {
                ...e,
                endTime: now,
                reviewStatus: "resolved" as const,
                note: "Auto logout after inactivity countdown",
              };
            }
            return { ...e, endTime: now };
          }),
        };
      }
      return audit(next, userId, "auth.idle_logout", "employee", userId);
    });
    void (async () => {
      // Let the idle-ended session push first, then clear the httpOnly cookie.
      await new Promise((r) => setTimeout(r, 500));
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
        });
      } catch {
        // ignore
      }
      authenticatedRef.current = false;
      skipNextPush.current = true;
      setState(withSession(stripSession(createSeedState()), null));
    })();
  }, []);

  const resolveIdle = useCallback(
    (choice: "break" | "work" | "low_input", note?: string) => {
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const open = prev.sessions.find(
          (s) =>
            s.employeeId === prev.currentUserId && s.status === "idle_warning",
        );
        if (!open) return prev;
        const now = new Date().toISOString();
        let timeEvents = prev.timeEvents.map((e) =>
          e.sessionId === open.id && e.type === "idle_signal" && !e.endTime
            ? {
                ...e,
                endTime: now,
                reviewStatus: "resolved" as const,
                note:
                  note ??
                  (choice === "break"
                    ? "Confirmed as break"
                    : choice === "low_input"
                      ? "Confirmed as low-input work"
                      : "Resumed — idle signal kept separate from approved work"),
              }
            : e,
        );
        let status: Session["status"] = "active";
        if (choice === "break") {
          status = "on_break";
          timeEvents = [
            {
              id: uid("te"),
              sessionId: open.id,
              employeeId: prev.currentUserId,
              type: "break",
              startTime: now,
              source: "employee",
              reviewStatus: "confirmed",
              note: note ?? "Break after idle warning",
            },
            ...timeEvents,
          ];
        } else if (choice === "low_input") {
          timeEvents = [
            {
              id: uid("te"),
              sessionId: open.id,
              employeeId: prev.currentUserId,
              type: "work",
              startTime: now,
              source: "employee",
              reviewStatus: "confirmed",
              note: "Continued after low-input confirmation",
            },
            {
              id: uid("te"),
              sessionId: open.id,
              employeeId: prev.currentUserId,
              type: "low_input",
              startTime: now,
              endTime: now,
              source: "employee",
              reviewStatus: "confirmed",
              note: note ?? "Meeting / reading / accessibility",
            },
            ...timeEvents,
          ];
        } else {
          timeEvents = [
            {
              id: uid("te"),
              sessionId: open.id,
              employeeId: prev.currentUserId,
              type: "work",
              startTime: now,
              source: "employee",
              reviewStatus: "confirmed",
            },
            ...timeEvents,
          ];
        }
        const next = {
          ...prev,
          sessions: prev.sessions.map((s) =>
            s.id === open.id ? { ...s, status } : s,
          ),
          timeEvents,
        };
        return audit(
          next,
          prev.currentUserId,
          `session.resolve_idle.${choice}`,
          "session",
          open.id,
        );
      });
    },
    [],
  );

  const submitProgress = useCallback(
    (input: { taskId: string; notes: string; links: string[] }) => {
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const id = uid("sub");
        const submission: Submission = {
          id,
          taskId: input.taskId,
          employeeId: prev.currentUserId,
          submittedAt: new Date().toISOString(),
          notes: input.notes,
          links: input.links.filter(Boolean),
          reviewStatus: "pending",
        };
        const next = {
          ...prev,
          submissions: [submission, ...prev.submissions],
          tasks: prev.tasks.map((t) =>
            t.id === input.taskId ? { ...t, status: "submitted" as const } : t,
          ),
        };
        return audit(next, prev.currentUserId, "submission.create", "submission", id);
      });
    },
    [],
  );

  const reviewSubmission = useCallback(
    (
      submissionId: string,
      status: Exclude<ReviewStatus, "pending">,
      feedback: string,
    ) => {
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const sub = prev.submissions.find((s) => s.id === submissionId);
        if (!sub) return prev;
        const now = new Date().toISOString();
        const taskStatus =
          status === "approved"
            ? ("approved" as const)
            : status === "revision_requested"
              ? ("in_progress" as const)
              : ("submitted" as const);
        const next = {
          ...prev,
          submissions: prev.submissions.map((s) =>
            s.id === submissionId
              ? {
                  ...s,
                  reviewStatus: status,
                  managerFeedback: feedback,
                  reviewedAt: now,
                  reviewedBy: prev.currentUserId!,
                }
              : s,
          ),
          tasks: prev.tasks.map((t) =>
            t.id === sub.taskId ? { ...t, status: taskStatus } : t,
          ),
        };
        return audit(
          next,
          prev.currentUserId,
          `submission.${status}`,
          "submission",
          submissionId,
        );
      });
    },
    [],
  );

  const createTask = useCallback(
    (task: Omit<Task, "id" | "status">, initialStatus: Task["status"] = "assigned") => {
      let createdId: string | null = null;
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const id = uid("task");
        createdId = id;
        const next = {
          ...prev,
          tasks: [{ ...task, id, status: initialStatus }, ...prev.tasks],
        };
        return audit(next, prev.currentUserId, "task.create", "task", id);
      });
      return createdId;
    },
    [],
  );

  const updateTaskStatus = useCallback((taskId: string, status: Task["status"]) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const exists = prev.tasks.some((t) => t.id === taskId);
      if (!exists) return prev;
      const next = {
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
      };
      return audit(next, prev.currentUserId, "task.status_update", "task", taskId);
    });
  }, []);

  const updateTaskAssignee = useCallback((taskId: string, assigneeId: string) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const assignee = prev.employees.find((e) => e.id === assigneeId);
      if (!assignee) return prev;
      const exists = prev.tasks.some((t) => t.id === taskId);
      if (!exists) return prev;
      const next = {
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, assigneeId } : t,
        ),
      };
      return audit(next, prev.currentUserId, "task.reassign", "task", taskId);
    });
  }, []);

  const createMeetingGroup = useCallback(
    (input: { name: string; memberIds: string[] }) => {
      let createdId: string | null = null;
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const actor = prev.employees.find((e) => e.id === prev.currentUserId);
        if (!actor || actor.role !== "admin") return prev;
        const name = input.name.trim();
        if (!name) return prev;
        const activeIds = new Set(
          prev.employees
            .filter((e) => e.status === "active" && e.role !== "admin")
            .map((e) => e.id),
        );
        // Admins may also include themselves for facilitation.
        const memberIds = [
          ...new Set(
            input.memberIds.filter(
              (id) => activeIds.has(id) || id === actor.id,
            ),
          ),
        ];
        if (memberIds.length === 0) return prev;
        const id = uid("mgrp");
        createdId = id;
        const group: MeetingGroup = {
          id,
          name,
          memberIds,
          createdBy: actor.id,
          createdAt: new Date().toISOString(),
        };
        const next = {
          ...prev,
          meetingGroups: [group, ...(prev.meetingGroups ?? [])],
        };
        return audit(next, actor.id, "meeting.group_create", "meeting_group", id);
      });
      return createdId;
    },
    [],
  );

  const updateMeetingGroupMembers = useCallback(
    (groupId: string, memberIds: string[]) => {
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const actor = prev.employees.find((e) => e.id === prev.currentUserId);
        if (!actor || actor.role !== "admin") return prev;
        const activeIds = new Set(
          prev.employees.filter((e) => e.status === "active").map((e) => e.id),
        );
        const cleaned = [...new Set(memberIds.filter((id) => activeIds.has(id)))];
        const next = {
          ...prev,
          meetingGroups: (prev.meetingGroups ?? []).map((g) =>
            g.id === groupId ? { ...g, memberIds: cleaned } : g,
          ),
        };
        return audit(
          next,
          actor.id,
          "meeting.group_members",
          "meeting_group",
          groupId,
        );
      });
    },
    [],
  );

  const createMeeting = useCallback(
    (input: {
      kind: MeetingKind;
      title: string;
      participantIds: string[];
      groupId?: string;
      meetingLink?: string;
      scheduledAt?: string;
      notes?: string;
      sendNow?: boolean;
    }) => {
      let createdId: string | null = null;
      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const actor = prev.employees.find((e) => e.id === prev.currentUserId);
        if (!actor || actor.role !== "admin") return prev;
        const title = input.title.trim();
        if (!title) return prev;

        let participantIds = [...new Set(input.participantIds)];
        if (input.kind === "group") {
          const group = (prev.meetingGroups ?? []).find(
            (g) => g.id === input.groupId,
          );
          if (!group) return prev;
          participantIds = [...group.memberIds];
        } else if (participantIds.length !== 1) {
          return prev;
        }

        const id = uid("meet");
        createdId = id;
        const now = new Date().toISOString();
        const link = input.meetingLink?.trim() || undefined;
        const scheduledAt = input.scheduledAt?.trim() || undefined;
        if (input.sendNow && link && !scheduledAt) {
          return prev;
        }
        const meeting: Meeting = {
          id,
          kind: input.kind,
          title,
          groupId: input.kind === "group" ? input.groupId : undefined,
          participantIds,
          meetingLink: link,
          scheduledAt,
          notes: input.notes?.trim() || undefined,
          createdBy: actor.id,
          createdAt: now,
          linkSentAt: input.sendNow && link ? now : undefined,
        };

        let notifications = prev.notifications ?? [];
        if (input.sendNow && link) {
          const notes: AppNotification[] = participantIds.map((userId) => ({
            id: uid("ntf"),
            userId,
            type: "meeting_link" as const,
            title: `Meeting: ${title}`,
            body: meetingInviteBody({
              actorName: actor.name,
              kind: input.kind,
              scheduledAt,
            }),
            meetingId: id,
            groupId: meeting.groupId,
            link,
            createdAt: now,
          }));
          notifications = [...notes, ...notifications].slice(0, 3000);
        }

        const next = {
          ...prev,
          meetings: [meeting, ...(prev.meetings ?? [])],
          notifications,
        };
        return audit(next, actor.id, "meeting.create", "meeting", id);
      });
      return createdId;
    },
    [],
  );

  const updateMeetingLink = useCallback((meetingId: string, meetingLink: string) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const actor = prev.employees.find((e) => e.id === prev.currentUserId);
      if (!actor || actor.role !== "admin") return prev;
      const link = meetingLink.trim();
      if (!link) return prev;
      const next = {
        ...prev,
        meetings: (prev.meetings ?? []).map((m) =>
          m.id === meetingId ? { ...m, meetingLink: link } : m,
        ),
      };
      return audit(next, actor.id, "meeting.link_update", "meeting", meetingId);
    });
  }, []);

  const sendMeetingLink = useCallback(
    (meetingId: string, opts?: { scheduledAt?: string }) => {
      let error: string | undefined;
      setState((prev) => {
        if (!prev.currentUserId) {
          error = "Not signed in.";
          return prev;
        }
        const actor = prev.employees.find((e) => e.id === prev.currentUserId);
        if (!actor || actor.role !== "admin") {
          error = "Only admins can send meeting links.";
          return prev;
        }
        const meeting = (prev.meetings ?? []).find((m) => m.id === meetingId);
        if (!meeting) {
          error = "Meeting not found.";
          return prev;
        }
        if (!meeting.meetingLink?.trim()) {
          error = "Paste a meeting link first.";
          return prev;
        }
        const scheduledAt =
          opts?.scheduledAt?.trim() || meeting.scheduledAt || undefined;
        if (!scheduledAt) {
          error = "Set the meeting date and time before sending.";
          return prev;
        }
        const startMs = new Date(scheduledAt).getTime();
        if (!Number.isFinite(startMs)) {
          error = "Invalid meeting time.";
          return prev;
        }
        const now = new Date().toISOString();
        const notes: AppNotification[] = meeting.participantIds.map((userId) => ({
          id: uid("ntf"),
          userId,
          type: "meeting_link" as const,
          title: `Meeting: ${meeting.title}`,
          body: meetingInviteBody({
            actorName: actor.name,
            kind: meeting.kind,
            scheduledAt,
          }),
          meetingId: meeting.id,
          groupId: meeting.groupId,
          link: meeting.meetingLink,
          createdAt: now,
        }));
        const next = {
          ...prev,
          meetings: (prev.meetings ?? []).map((m) =>
            m.id === meetingId
              ? {
                  ...m,
                  scheduledAt,
                  linkSentAt: now,
                  // New time → allow a fresh 15‑minute reminder
                  reminderSentAt:
                    m.scheduledAt === scheduledAt ? m.reminderSentAt : undefined,
                }
              : m,
          ),
          notifications: [...notes, ...(prev.notifications ?? [])].slice(0, 3000),
        };
        return audit(next, actor.id, "meeting.link_send", "meeting", meetingId);
      });
      if (error) return { ok: false, error };
      return { ok: true };
    },
    [],
  );

  const sendGroupChat = useCallback((groupId: string, body: string) => {
    let error: string | undefined;
    setState((prev) => {
      if (!prev.currentUserId) {
        error = "Not signed in.";
        return prev;
      }
      const text = body.trim();
      if (!text) {
        error = "Type a message first.";
        return prev;
      }
      const group = (prev.meetingGroups ?? []).find((g) => g.id === groupId);
      if (!group) {
        error = "Group not found.";
        return prev;
      }
      const actor = prev.employees.find((e) => e.id === prev.currentUserId);
      if (!actor) {
        error = "Account not found.";
        return prev;
      }
      const isMember = group.memberIds.includes(actor.id);
      const isAdmin = actor.role === "admin";
      if (!isMember && !isAdmin) {
        error = "You are not in this group.";
        return prev;
      }
      const now = new Date().toISOString();
      const message: ChatMessage = {
        id: uid("chat"),
        groupId,
        authorId: actor.id,
        body: text.slice(0, 2000),
        createdAt: now,
      };
      // Notify other members about new chat (lightweight)
      const recipients = group.memberIds.filter((id) => id !== actor.id);
      const notes: AppNotification[] = recipients.map((userId) => ({
        id: uid("ntf"),
        userId,
        type: "chat_message" as const,
        title: `${group.name} chat`,
        body: `${actor.name}: ${text.slice(0, 120)}`,
        groupId,
        createdAt: now,
      }));
      const next = {
        ...prev,
        chatMessages: [...(prev.chatMessages ?? []), message].slice(-5000),
        notifications: [...notes, ...(prev.notifications ?? [])].slice(0, 3000),
      };
      return audit(next, actor.id, "meeting.chat", "meeting_group", groupId);
    });
    if (error) return { ok: false, error };
    return { ok: true };
  }, []);

  const markNotificationRead = useCallback((notificationId: string) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const now = new Date().toISOString();
      return {
        ...prev,
        notifications: (prev.notifications ?? []).map((n) =>
          n.id === notificationId && n.userId === prev.currentUserId
            ? { ...n, readAt: n.readAt ?? now }
            : n,
        ),
      };
    });
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const now = new Date().toISOString();
      const uid_ = prev.currentUserId;
      return {
        ...prev,
        notifications: (prev.notifications ?? []).map((n) =>
          n.userId === uid_ ? { ...n, readAt: n.readAt ?? now } : n,
        ),
      };
    });
  }, []);

  const updatePolicy = useCallback((patch: Partial<MonitoringPolicy>) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const next = { ...prev, policy: { ...prev.policy, ...patch } };
      return audit(next, prev.currentUserId, "policy.update", "policy", "global");
    });
  }, []);

  const resolveReportWindow = useCallback(
    (
      period: ReportPeriod,
      customRange?: { start: string; end: string },
    ): { start: Date; end: Date; kind: ReportKind } | null => {
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const start = new Date();
      start.setHours(0, 0, 0, 0);

      if (period === "day") {
        return { start, end, kind: "daily" };
      }
      if (period === "week") {
        start.setDate(start.getDate() - 6);
        return { start, end, kind: "weekly" };
      }
      if (period === "month") {
        start.setDate(start.getDate() - 29);
        return { start, end, kind: "monthly" };
      }
      if (period === "year") {
        start.setFullYear(start.getFullYear() - 1);
        start.setDate(start.getDate() + 1);
        return { start, end, kind: "yearly" };
      }
      if (period === "custom" && customRange?.start && customRange?.end) {
        const customStart = new Date(customRange.start);
        const customEnd = new Date(customRange.end);
        if (Number.isNaN(customStart.getTime()) || Number.isNaN(customEnd.getTime())) {
          return null;
        }
        customStart.setHours(0, 0, 0, 0);
        customEnd.setHours(23, 59, 59, 999);
        if (customEnd < customStart) return null;
        return { start: customStart, end: customEnd, kind: "custom" };
      }
      return null;
    },
    [],
  );

  const generateEmployeeReport = useCallback(
    (
      employeeId: string,
      period: ReportPeriod,
      customRange?: { start: string; end: string },
    ) => {
      let report: Report | null = null;
      const window = resolveReportWindow(period, customRange);
      if (!window) return null;

      setState((prev) => {
        if (!prev.currentUserId) return prev;
        const { start, end, kind } = window;
        const startMs = start.getTime();
        const endMs = end.getTime();
        const inRange = (iso: string) => {
          const t = new Date(iso).getTime();
          return t >= startMs && t <= endMs;
        };

        const events = prev.timeEvents.filter(
          (e) => e.employeeId === employeeId && inRange(e.startTime),
        );
        const sessions = prev.sessions.filter(
          (s) => s.employeeId === employeeId && inRange(s.startTime),
        );
        const tasks = prev.tasks.filter(
          (t) => t.assigneeId === employeeId && inRange(t.startDate),
        );
        const subs = prev.submissions.filter(
          (s) => s.employeeId === employeeId && inRange(s.submittedAt),
        );
        const sessionMinutes = sessions.reduce(
          (acc, s) => acc + minutesBetween(s.startTime, s.endTime),
          0,
        );
        const sumType = (type: TimeEvent["type"]) =>
          events
            .filter((e) => e.type === type)
            .reduce((acc, e) => acc + minutesBetween(e.startTime, e.endTime), 0);

        report = {
          id: uid("rep"),
          employeeId,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          kind,
          generatedAt: new Date().toISOString(),
          deliveryStatus: "ready",
          summary: {
            sessionMinutes,
            workMinutes: sumType("work") + sumType("low_input"),
            breakMinutes: sumType("break"),
            idleMinutes: sumType("idle_signal"),
            tasksAssigned: tasks.length,
            tasksSubmitted: subs.length,
            tasksApproved: tasks.filter((t) => t.status === "approved").length,
          },
        };
        const next = { ...prev, reports: [report!, ...prev.reports] };
        return audit(
          next,
          prev.currentUserId,
          `report.generate_${kind}`,
          "report",
          report!.id,
        );
      });
      return report;
    },
    [resolveReportWindow],
  );

  const generateDailyReport = useCallback(
    (employeeId: string) => generateEmployeeReport(employeeId, "day"),
    [generateEmployeeReport],
  );

  const runBackup = useCallback(() => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const started = new Date().toISOString();
      const id = uid("bak");
      const next = {
        ...prev,
        backups: [
          {
            id,
            scope:
              "Manual backup — sessions, tasks, submissions, reports, audit logs",
            startedAt: started,
            completedAt: new Date().toISOString(),
            verificationStatus: "verified" as const,
          },
          ...prev.backups,
        ],
      };
      return audit(next, prev.currentUserId, "backup.run", "backup", id);
    });
  }, []);

  const runManualBackup = useCallback(() => {
    let payload: { ok: boolean; filename: string; json: string } | null = null;
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const actor = prev.employees.find((e) => e.id === prev.currentUserId);
      if (!actor || actor.role !== "admin") return prev;

      const started = new Date().toISOString();
      const id = uid("bak");
      const stamp = started.replace(/[:.]/g, "-");
      const filename = `claritytrack-backup-${stamp}.json`;
      const exportState = {
        exportedAt: started,
        exportedBy: { id: actor.id, name: actor.name, email: actor.email },
        policy: prev.policy,
        employees: prev.employees.map(({ password: _pw, ...rest }) => rest),
        sessions: prev.sessions,
        timeEvents: prev.timeEvents,
        tasks: prev.tasks,
        submissions: prev.submissions,
        reports: prev.reports,
        backups: prev.backups,
        auditLogs: prev.auditLogs,
        screenshots: prev.screenshots,
      };
      payload = {
        ok: true,
        filename,
        json: JSON.stringify(exportState, null, 2),
      };

      const next = {
        ...prev,
        backups: [
          {
            id,
            scope: `Manual download — ${filename}`,
            startedAt: started,
            completedAt: new Date().toISOString(),
            verificationStatus: "verified" as const,
          },
          ...prev.backups,
        ],
      };
      return audit(next, prev.currentUserId, "backup.manual_download", "backup", id);
    });
    return payload;
  }, []);

  const disputeTimeEvent = useCallback((eventId: string, note: string) => {
    setState((prev) => {
      if (!prev.currentUserId) return prev;
      const next = {
        ...prev,
        timeEvents: prev.timeEvents.map((e) =>
          e.id === eventId
            ? { ...e, reviewStatus: "disputed" as const, note }
            : e,
        ),
      };
      return audit(
        next,
        prev.currentUserId,
        "time_event.dispute",
        "time_event",
        eventId,
      );
    });
  }, []);

  const resetDemo = useCallback(() => {
    void (async () => {
      try {
        const res = await fetch("/api/store", {
          method: "DELETE",
          credentials: "include",
        });
        if (res.ok) {
          const data = (await res.json()) as StoreEnvelope;
          authenticatedRef.current = false;
          versionRef.current = data.version;
          skipNextPush.current = true;
          setNeedsAdminSetupFlag(Boolean(data.needsAdminSetup ?? true));
          setState(
            withSession(
              data.state ? normalizeShared(data.state) : stripSession(createSeedState()),
              null,
            ),
          );
          return;
        }
      } catch {
        // fall through to local reset
      }
      authenticatedRef.current = false;
      skipNextPush.current = true;
      setState(createSeedState());
    })();
  }, []);

  const refreshFromServer = useCallback(async () => {
    try {
      const res = await fetch("/api/store", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as StoreEnvelope;
      setNeedsAdminSetupFlag(Boolean(data.needsAdminSetup));
      if (data.authenticated && data.state) {
        authenticatedRef.current = true;
        applyShared(data.state, data.version, data.currentUserId ?? null);
      }
    } catch {
      // ignore transient errors
    }
  }, [applyShared]);

  const needsAdminSetup = needsAdminSetupFlag;

  const api: StoreApi = {
    ready,
    state,
    currentUser,
    activeSession,
    login,
    register,
    registerAdmin,
    bootstrapAdmin,
    reviewRegistration,
    logout,
    needsAdminSetup,
    needsPlatformSetup,
    sessionKind,
    company,
    startSession,
    acknowledgeMonitoring,
    endSession,
    startBreak,
    resumeWork,
    markLowInput,
    resolveIdle,
    triggerIdleWarning,
    forceIdleLogout,
    submitProgress,
    reviewSubmission,
    createTask,
    updateTaskStatus,
    updateTaskAssignee,
    createMeetingGroup,
    updateMeetingGroupMembers,
    createMeeting,
    updateMeetingLink,
    sendMeetingLink,
    sendGroupChat,
    markNotificationRead,
    markAllNotificationsRead,
    updatePolicy,
    generateDailyReport,
    generateEmployeeReport,
    runBackup,
    runManualBackup,
    disputeTimeEvent,
    resetDemo,
    refreshFromServer,
    employeeTasks: (employeeId) =>
      state.tasks.filter((t) => t.assigneeId === employeeId),
    pendingSubmissions: () =>
      state.submissions.filter((s) => s.reviewStatus === "pending"),
    pendingRegistrations: () =>
      state.employees.filter((e) => e.status === "pending"),
    teamEmployees: () =>
      state.employees.filter(
        (e) => e.role === "employee" && e.status === "active",
      ),
  };

  return (
    <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
