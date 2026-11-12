"use client";

import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDuration, minutesBetween, sumEventMinutes } from "@/lib/time";

function TeamTime() {
  const { state, teamEmployees } = useStore();
  const employees = teamEmployees();

  return (
    <AppShell title="Team time overview">
      <p className="mb-4 text-muted-foreground">
        Session duration, confirmed breaks, and idle signals are shown separately. Do not treat idle
        or screenshots as proof of output.
      </p>
      <div className="space-y-3">
        {employees.map((emp) => {
          const sessions = state.sessions.filter((s) => s.employeeId === emp.id);
          const events = state.timeEvents.filter((e) => e.employeeId === emp.id);
          const latest = sessions[0];
          return (
            <article
              key={emp.id}
              className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold">{emp.name}</h2>
                  <p className="text-sm text-muted-foreground">{emp.email}</p>
                </div>
                <Badge variant="secondary">
                  {latest ? latest.status.replaceAll("_", " ") : "no session"}
                </Badge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
                <Stat
                  label="Latest session"
                  value={
                    latest
                      ? formatDuration(minutesBetween(latest.startTime, latest.endTime))
                      : "—"
                  }
                />
                <Stat label="Work signals" value={formatDuration(sumEventMinutes(events, "work"))} />
                <Stat label="Breaks" value={formatDuration(sumEventMinutes(events, "break"))} />
                <Stat
                  label="Idle signals"
                  value={formatDuration(sumEventMinutes(events, "idle_signal"))}
                />
              </div>
              {latest && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Last start {formatDateTime(latest.startTime)}
                  {latest.endTime ? ` · ended ${formatDateTime(latest.endTime)}` : " · in progress"}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading text-lg font-semibold">{value}</p>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["manager"]}>
      <TeamTime />
    </AuthGate>
  );
}
