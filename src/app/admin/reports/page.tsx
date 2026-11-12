"use client";

import { useMemo, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDuration, minutesBetween, sumEventMinutes } from "@/lib/time";
import type { ReportPeriod } from "@/lib/types";

const PERIODS: { id: ReportPeriod; label: string }[] = [
  { id: "day", label: "1 day" },
  { id: "week", label: "1 week" },
  { id: "month", label: "1 month" },
  { id: "year", label: "1 year" },
];

function AdminReports() {
  const { state, generateEmployeeReport } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const people = useMemo(
    () =>
      state.employees
        .filter((e) => e.status === "active" && e.role === "employee")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.employees],
  );

  const selected = people.find((e) => e.id === selectedId) ?? null;
  const selectedReports = selected
    ? state.reports.filter((r) => r.employeeId === selected.id)
    : [];

  const live = useMemo(() => {
    if (!selected) return null;
    const sessions = state.sessions.filter((s) => s.employeeId === selected.id);
    const events = state.timeEvents.filter((e) => e.employeeId === selected.id);
    const tasks = state.tasks.filter((t) => t.assigneeId === selected.id);
    const submissions = state.submissions.filter((s) => s.employeeId === selected.id);
    return {
      work: sumEventMinutes(events, "work") + sumEventMinutes(events, "low_input"),
      breaks: sumEventMinutes(events, "break"),
      idle: sumEventMinutes(events, "idle_signal"),
      tasksAssigned: tasks.length,
      tasksOpen: tasks.filter((t) => t.status === "assigned" || t.status === "in_progress").length,
      tasksSubmitted: submissions.length,
      tasksApproved: tasks.filter((t) => t.status === "approved").length,
      latestSession: sessions[0] ?? null,
    };
  }, [selected, state.sessions, state.timeEvents, state.tasks, state.submissions]);

  function onGenerate() {
    if (!selected) return;
    setError("");
    setMessage("");
    const report = generateEmployeeReport(
      selected.id,
      period,
      period === "custom"
        ? { start: customStart, end: customEnd }
        : undefined,
    );
    if (!report) {
      setError(
        period === "custom"
          ? "Pick a valid custom from/to date range, then generate."
          : "Could not generate report.",
      );
      return;
    }
    setMessage(
      `Generated ${report.kind} report for ${selected.name} (${formatDateTime(report.periodStart)} → ${formatDateTime(report.periodEnd)}).`,
    );
  }

  function exportCsv(reportId: string) {
    const report = state.reports.find((r) => r.id === reportId);
    if (!report) return;
    const emp = state.employees.find((e) => e.id === report.employeeId);
    const rows = [
      ["employee", emp?.name ?? report.employeeId],
      ["email", emp?.email ?? ""],
      ["kind", report.kind],
      ["period_start", report.periodStart],
      ["period_end", report.periodEnd],
      ["generated_at", report.generatedAt],
      ["session_minutes", String(Math.round(report.summary.sessionMinutes))],
      ["work_minutes", String(Math.round(report.summary.workMinutes))],
      ["break_minutes", String(Math.round(report.summary.breakMinutes))],
      ["idle_minutes", String(Math.round(report.summary.idleMinutes))],
      ["tasks_assigned", String(report.summary.tasksAssigned)],
      ["tasks_submitted", String(report.summary.tasksSubmitted)],
      ["tasks_approved", String(report.summary.tasksApproved)],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${emp?.name?.replace(/\s+/g, "-") ?? report.employeeId}-${report.kind}-${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Reports">
      <p className="mb-4 text-muted-foreground">
        Admin-only: generate any employee&apos;s work report for 1 day, 1 week, 1 month, 1 year, or a
        manual custom date range.
      </p>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border border-border/80 bg-white/90 p-3">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Employees
          </p>
          <ul className="max-h-[70vh] space-y-1 overflow-auto">
            {people.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(e.id);
                    setMessage("");
                    setError("");
                  }}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selectedId === e.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-secondary"
                  }`}
                >
                  <span className="block font-medium">{e.name}</span>
                  <span
                    className={`block text-xs ${
                      selectedId === e.id ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {e.team}
                  </span>
                </button>
              </li>
            ))}
            {people.length === 0 && (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">
                No active employees yet.
              </li>
            )}
          </ul>
        </aside>

        <div className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              Select an employee to generate a work report.
            </div>
          ) : (
            <>
              <section className="rounded-xl border border-border/80 bg-white/90 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-heading text-2xl font-semibold">{selected.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selected.email} · {selected.team}
                    </p>
                  </div>
                </div>

                <div className="mt-5">
                  <p className="mb-2 text-sm font-medium">Report period</p>
                  <div className="flex flex-wrap gap-2">
                    {PERIODS.map((p) => (
                      <Button
                        key={p.id}
                        type="button"
                        size="sm"
                        variant={period === p.id ? "default" : "outline"}
                        onClick={() => setPeriod(p.id)}
                      >
                        {p.label}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant={period === "custom" ? "default" : "outline"}
                      onClick={() => setPeriod("custom")}
                    >
                      Manual range
                    </Button>
                  </div>
                </div>

                {period === "custom" && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="custom-start">From</Label>
                      <Input
                        id="custom-start"
                        type="date"
                        value={customStart}
                        onChange={(e) => setCustomStart(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="custom-end">To</Label>
                      <Input
                        id="custom-end"
                        type="date"
                        value={customEnd}
                        onChange={(e) => setCustomEnd(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={onGenerate}>Generate report</Button>
                </div>
                {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}
                {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

                {live && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Work time (all-time live)" value={formatDuration(live.work)} />
                    <Stat label="Breaks" value={formatDuration(live.breaks)} />
                    <Stat label="Tasks assigned" value={String(live.tasksAssigned)} />
                    <Stat label="Submissions" value={String(live.tasksSubmitted)} />
                  </div>
                )}

                {live?.latestSession && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Latest session:{" "}
                    <Badge variant="secondary" className="mx-1">
                      {live.latestSession.status.replaceAll("_", " ")}
                    </Badge>
                    started {formatDateTime(live.latestSession.startTime)}
                    {live.latestSession.endTime
                      ? ` · ended ${formatDateTime(live.latestSession.endTime)} (${formatDuration(minutesBetween(live.latestSession.startTime, live.latestSession.endTime))})`
                      : " · in progress"}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-heading text-lg font-semibold">Generated reports</h3>
                {selectedReports.map((report) => (
                  <article
                    key={report.id}
                    className="rounded-xl border border-border/80 bg-white/90 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize">{report.kind} report</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(report.periodStart)} → {formatDateTime(report.periodEnd)}
                          <span className="mx-1">·</span>
                          Generated {formatDateTime(report.generatedAt)}
                        </p>
                      </div>
                      <Badge variant="secondary">{report.deliveryStatus}</Badge>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-6 text-sm">
                      <Mini label="Session" value={formatDuration(report.summary.sessionMinutes)} />
                      <Mini label="Work" value={formatDuration(report.summary.workMinutes)} />
                      <Mini label="Breaks" value={formatDuration(report.summary.breakMinutes)} />
                      <Mini label="Idle" value={formatDuration(report.summary.idleMinutes)} />
                      <Mini label="Tasks" value={String(report.summary.tasksAssigned)} />
                      <Mini label="Submitted" value={String(report.summary.tasksSubmitted)} />
                    </div>
                    <Button
                      className="mt-3"
                      variant="outline"
                      size="sm"
                      onClick={() => exportCsv(report.id)}
                    >
                      Export CSV
                    </Button>
                  </article>
                ))}
                {selectedReports.length === 0 && (
                  <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                    No reports for this employee yet. Choose a period and generate.
                  </p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["admin"]}>
      <AdminReports />
    </AuthGate>
  );
}
