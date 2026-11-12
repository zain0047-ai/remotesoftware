"use client";

import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

function TransparencyPage() {
  const { currentUser, state } = useStore();
  const myShots = state.screenshots.filter((s) => s.employeeId === currentUser?.id);
  const myAudits = state.auditLogs.filter((a) => a.actorId === currentUser?.id).slice(0, 12);

  return (
    <AppShell title="Transparency & corrections">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5">
          <h2 className="font-heading text-lg font-semibold">What is tracked</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            <li>Session start/end timestamps and end reason</li>
            <li>Explicit breaks and low-input markers you confirm</li>
            <li>Idle signals from browser-tab inactivity (not keystroke content)</li>
            <li>Task assignments, submissions, and manager feedback</li>
            <li>
              Screenshot evidence only when policy enables it — this MVP stores{" "}
              <strong>simulated</strong> frames, not OS captures
            </li>
          </ul>
          <h3 className="font-heading mt-5 text-base font-semibold">Why</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            To support accountable remote work with visible policy, separate time categories, and
            manager review of task output — not covert surveillance.
          </p>
          <h3 className="font-heading mt-5 text-base font-semibold">Retention</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Screenshot retention: {state.policy.screenshotRetentionDays} days. Request deletion or
            correction through your manager; disputes are logged in the audit trail.
          </p>
        </section>

        <section className="animate-slide-up stagger-2 rounded-xl border border-border/80 bg-white/90 p-5">
          <h2 className="font-heading text-lg font-semibold">Your evidence frames</h2>
          <div className="mt-3 space-y-3">
            {myShots.map((s) => (
              <div key={s.id} className="rounded-md border border-border/60 p-3 text-sm">
                <p className="font-medium">{s.label}</p>
                <p className="text-muted-foreground">
                  {formatDateTime(s.timestamp)} · retain until {formatDateTime(s.retentionUntil)}
                </p>
                <p className="mt-1 text-xs uppercase tracking-wide text-amber-700">Simulated</p>
              </div>
            ))}
            {myShots.length === 0 && (
              <p className="text-sm text-muted-foreground">No evidence frames for your account.</p>
            )}
          </div>
        </section>
      </div>

      <section className="animate-slide-up stagger-3 mt-4 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Your recent audit events</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Action</th>
                <th className="py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {myAudits.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 pr-3">{formatDateTime(a.timestamp)}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{a.action}</td>
                  <td className="py-2 capitalize">{a.outcome}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["employee"]}>
      <TransparencyPage />
    </AuthGate>
  );
}
