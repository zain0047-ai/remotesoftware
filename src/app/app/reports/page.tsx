"use client";

import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDuration } from "@/lib/time";

function ReportsPage() {
  const { currentUser, state, generateDailyReport } = useStore();
  const reports = state.reports.filter((r) => r.employeeId === currentUser?.id);

  function exportCsv(reportId: string) {
    const report = reports.find((r) => r.id === reportId);
    if (!report) return;
    const rows = [
      ["metric", "value", "note"],
      ["session_minutes", String(report.summary.sessionMinutes), "Elapsed session time"],
      ["work_minutes", String(report.summary.workMinutes), "Work time"],
      ["break_minutes", String(report.summary.breakMinutes), "Confirmed breaks"],
      ["tasks_assigned", String(report.summary.tasksAssigned), ""],
      ["tasks_submitted", String(report.summary.tasksSubmitted), ""],
      ["tasks_approved", String(report.summary.tasksApproved), "Manager-reviewed outcomes"],
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.kind}-report-${report.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell title="Reports">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">
          Daily summary of your session time, breaks, and task progress.
        </p>
        <Button
          onClick={() => {
            if (currentUser) generateDailyReport(currentUser.id);
          }}
        >
          Generate today&apos;s report
        </Button>
      </div>

      <div className="space-y-3">
        {reports.map((report) => (
          <article
            key={report.id}
            className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-xl font-semibold capitalize">
                  {report.kind} report
                </h2>
                <p className="text-sm text-muted-foreground">
                  Generated {formatDateTime(report.generatedAt)}
                </p>
              </div>
              <Badge variant="secondary">{report.deliveryStatus}</Badge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Stat label="Session" value={formatDuration(report.summary.sessionMinutes)} />
              <Stat label="Work" value={formatDuration(report.summary.workMinutes)} />
              <Stat label="Breaks" value={formatDuration(report.summary.breakMinutes)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>Tasks assigned: {report.summary.tasksAssigned}</span>
              <span>Submitted: {report.summary.tasksSubmitted}</span>
              <span>Approved: {report.summary.tasksApproved}</span>
            </div>
            <Button className="mt-4" variant="outline" onClick={() => exportCsv(report.id)}>
              Export CSV
            </Button>
          </article>
        ))}
        {reports.length === 0 && (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            No reports yet.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading text-xl font-semibold">{value}</p>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["employee"]}>
      <ReportsPage />
    </AuthGate>
  );
}
