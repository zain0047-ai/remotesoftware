import { NextResponse } from "next/server";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { readStore, writeStore } from "@/lib/server-db";
import { findActor } from "@/lib/store-access";
import {
  clearSessionCookie,
  readSessionFromRequest,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensureTenancyMigrated();
  const session = readSessionFromRequest(request);

  if (session?.kind === "tenant" && session.tenantId) {
    const store = await readStore(session.tenantId);
    const actor = findActor(store.state, session.userId);
    if (actor) {
      const now = new Date().toISOString();
      const open = store.state.sessions.find(
        (s) =>
          s.employeeId === actor.id &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      );
      let sessions = store.state.sessions;
      let timeEvents = store.state.timeEvents;
      if (open) {
        sessions = sessions.map((s) =>
          s.id === open.id
            ? {
                ...s,
                status: "ended" as const,
                endTime: now,
                endReason: "logout",
              }
            : s,
        );
        timeEvents = timeEvents.map((e) =>
          e.sessionId === open.id && !e.endTime ? { ...e, endTime: now } : e,
        );
      }
      const next = {
        ...store.state,
        employees: store.state.employees.map((e) =>
          e.id === actor.id
            ? { ...e, presence: "offline" as const, lastSeenAt: now }
            : e,
        ),
        sessions,
        timeEvents,
        auditLogs: [
          {
            id: `aud_${Date.now().toString(36)}`,
            actorId: actor.id,
            action: "auth.logout",
            targetType: "employee",
            targetId: actor.id,
            timestamp: now,
            outcome: "success" as const,
          },
          ...store.state.auditLogs,
        ],
      };
      const saved = await writeStore(session.tenantId, next);
      const response = NextResponse.json({
        ok: true,
        authenticated: false,
        version: saved.version,
        state: null,
        currentUserId: null,
      });
      clearSessionCookie(response, request);
      return response;
    }
  }

  const response = NextResponse.json({
    ok: true,
    authenticated: false,
    version: 0,
    state: null,
    currentUserId: null,
  });
  clearSessionCookie(response, request);
  return response;
}
