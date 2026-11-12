"use client";

import { useMemo } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { IdleMonitor } from "@/components/idle-monitor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDuration, minutesBetween, sumEventMinutes } from "@/lib/time";

function WorkSession() {
  const {
    currentUser,
    activeSession,
    state,
    startSession,
    endSession,
    startBreak,
    resumeWork,
  } = useStore();

  const sessionEvents = activeSession
    ? state.timeEvents.filter(
        (e) =>
          e.sessionId === activeSession.id &&
          (e.type === "work" || e.type === "break" || e.type === "low_input"),
      )
    : [];

  const workMin =
    sumEventMinutes(sessionEvents, "work") + sumEventMinutes(sessionEvents, "low_input");
  const breakMin = sumEventMinutes(sessionEvents, "break");
  const elapsed = activeSession
    ? minutesBetween(activeSession.startTime, activeSession.endTime)
    : 0;

  const myTasks = useMemo(
    () => state.tasks.filter((t) => t.assigneeId === currentUser?.id).slice(0, 3),
    [state.tasks, currentUser],
  );

  const statusLabel =
    activeSession?.status === "idle_warning"
      ? "active"
      : activeSession
        ? activeSession.status.replaceAll("_", " ")
        : "Not started";

  return (
    <AppShell title="Work session">
      <IdleMonitor />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Session status</p>
              <p className="font-heading mt-1 text-2xl font-semibold capitalize">
                {statusLabel}
              </p>
              {activeSession && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Started {formatDateTime(activeSession.startTime)} · Elapsed{" "}
                  {formatDuration(elapsed)}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {!activeSession && (
                <Button onClick={startSession}>Start work session</Button>
              )}
              {activeSession?.status === "active" && (
                <>
                  <Button variant="secondary" onClick={() => startBreak()}>
                    Take break
                  </Button>
                  <Button onClick={resumeWork} variant="outline" className="hidden">
                    Resume
                  </Button>
                  <Button variant="destructive" onClick={() => endSession("manual_end")}>
                    End session
                  </Button>
                </>
              )}
              {(activeSession?.status === "on_break" ||
                activeSession?.status === "idle_warning") && (
                <>
                  {activeSession.status === "on_break" && (
                    <Button onClick={resumeWork}>Resume work</Button>
                  )}
                  <Button variant="destructive" onClick={() => endSession("manual_end")}>
                    End session
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Metric label="Work time" value={formatDuration(workMin)} />
            <Metric label="Breaks" value={formatDuration(breakMin)} />
          </div>
        </section>

        <section className="animate-slide-up stagger-2 rounded-xl border border-border/80 bg-white/90 p-5">
          <h2 className="font-heading text-lg font-semibold">Today&apos;s tasks</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {myTasks.map((t) => (
              <li key={t.id} className="rounded-md border border-border/60 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{t.title}</span>
                  <Badge variant="secondary">{t.priority}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">Due {formatDateTime(t.dueDate)}</p>
              </li>
            ))}
            {myTasks.length === 0 && (
              <li className="text-muted-foreground">No assigned tasks yet.</li>
            )}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/60 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function AppPage() {
  return (
    <AuthGate roles={["employee"]}>
      <WorkSession />
    </AuthGate>
  );
}
