"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { formatDateTime, formatDuration, minutesBetween } from "@/lib/time";
import type { Employee, EmployeeStatus } from "@/lib/types";

function accountLabel(status: EmployeeStatus): string {
  switch (status) {
    case "active":
      return "Approved";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    case "inactive":
      return "Disabled";
    default:
      return status;
  }
}

function isSignedIn(e: Employee): boolean {
  return e.presence === "online";
}

function AdminHome() {
  const { state, pendingRegistrations, reviewRegistration, company } = useStore();
  const pending = pendingRegistrations();
  const onlineCount = state.employees.filter((e) => e.presence === "online").length;
  const [installUrl, setInstallUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setInstallUrl(`${window.location.origin}/install`);
  }, []);

  async function copyInstallLink() {
    if (!installUrl) return;
    try {
      await navigator.clipboard.writeText(installUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <AppShell title="Admin overview">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Users" value={String(state.employees.length)} />
        <Stat label="Signed in now" value={String(onlineCount)} />
        <Stat label="Pending approvals" value={String(pending.length)} />
        <Stat label="Open work sessions" value={String(state.sessions.filter((s) => !s.endTime).length)} />
      </div>

      <section className="mt-6 animate-slide-up rounded-xl border border-teal-200 bg-teal-50/80 p-5">
        <h2 className="font-heading text-lg font-semibold">
          Send app to employees (browser install)
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Share this link on WhatsApp / email. Staff open it in Chrome or Safari
          and install ClarityTrack like an app — no Play Store / App Store needed.
          {company?.slug ? (
            <>
              {" "}
              Remind them to sign in with Company ID{" "}
              <code className="rounded bg-white/80 px-1 text-xs">{company.slug}</code>.
            </>
          ) : null}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <code className="flex-1 truncate rounded-lg border border-teal-200/80 bg-white px-3 py-2 text-xs sm:text-sm">
            {installUrl || "…"}
          </code>
          <Button type="button" size="sm" onClick={() => void copyInstallLink()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy install link"}
          </Button>
        </div>
      </section>

      {state.employees.length <= 1 && (
        <section className="mt-6 animate-slide-up rounded-xl border border-teal-200 bg-teal-50/80 p-5">
          <h2 className="font-heading text-lg font-semibold">Getting started</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-foreground">
            <li>Copy the <strong>install link</strong> above and send it to each employee.</li>
            <li>They install from the browser, then register / sign in with your Company ID.</li>
            <li>Approve pending employees under <strong>Pending approvals</strong> below.</li>
            <li>Use Policy / Backups in the top nav for inactivity settings and archives.</li>
          </ol>
        </section>
      )}

      <section className="mt-6 animate-slide-up rounded-xl border border-amber-200 bg-amber-50/80 p-5">
        <h2 className="font-heading text-lg font-semibold">Pending approvals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Employees and additional admins cannot sign in until you approve them here.
        </p>
        <div className="mt-4 space-y-3">
          {pending.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-white px-4 py-3 text-sm"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{e.name}</p>
                  <Badge variant={e.role === "admin" ? "default" : "secondary"}>
                    {e.role}
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  {e.email} · {e.team}
                  {e.registeredAt ? ` · requested ${formatDateTime(e.registeredAt)}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => reviewRegistration(e.id, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => reviewRegistration(e.id, "reject")}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
          {pending.length === 0 && (
            <p className="rounded-md border border-dashed border-amber-300/80 bg-white/70 px-4 py-6 text-center text-sm text-muted-foreground">
              No pending registrations.
            </p>
          )}
        </div>
      </section>

      <section className="mt-4 animate-slide-up stagger-2 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Users & roles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong>Account</strong> = approved to use the system.{" "}
          <strong>Signed in</strong> = currently logged in (updates when they sign out).
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Role</th>
                <th className="py-2 pr-3 font-medium">Account</th>
                <th className="py-2 pr-3 font-medium">Signed in</th>
                <th className="py-2 font-medium">Team</th>
              </tr>
            </thead>
            <tbody>
              {state.employees.map((e) => {
                const online = isSignedIn(e);
                return (
                  <tr key={e.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{e.name}</td>
                    <td className="py-2 pr-3">{e.email}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="secondary">{e.role}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={e.status === "pending" ? "outline" : "secondary"}
                      >
                        {accountLabel(e.status)}
                      </Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant={online ? "default" : "outline"}>
                        {online ? "Online" : "Offline"}
                      </Badge>
                      {e.lastSeenAt && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {online ? "since" : "last"} {formatDateTime(e.lastSeenAt)}
                        </span>
                      )}
                    </td>
                    <td className="py-2">{e.team}</td>
                  </tr>
                );
              })}
              {state.employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No users yet. Create the first admin from the home page.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 animate-slide-up stagger-3 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Employee breaks</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Break start/end and duration. When they resume, the timer stops and status becomes Active
          again.
        </p>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 font-medium">Break from</th>
                <th className="py-2 pr-3 font-medium">Break until</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {state.timeEvents
                .filter((e) => e.type === "break")
                .slice(0, 50)
                .map((e) => {
                  const emp = state.employees.find((x) => x.id === e.employeeId);
                  const session = state.sessions.find((s) => s.id === e.sessionId);
                  const status = !e.endTime
                    ? "On break"
                    : session?.status === "active"
                      ? "Resumed — active"
                      : session?.status === "ended" || session?.status === "interrupted"
                        ? "Break ended (session closed)"
                        : "Resumed";
                  return (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">{emp?.name ?? e.employeeId}</td>
                      <td className="py-2 pr-3">{formatDateTime(e.startTime)}</td>
                      <td className="py-2 pr-3">
                        {e.endTime ? formatDateTime(e.endTime) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDuration(minutesBetween(e.startTime, e.endTime))}
                      </td>
                      <td className="py-2">
                        <Badge variant={!e.endTime ? "outline" : "secondary"}>{status}</Badge>
                      </td>
                    </tr>
                  );
                })}
              {state.timeEvents.filter((e) => e.type === "break").length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No employee breaks recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 animate-slide-up stagger-3 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Work sessions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Session start, end, and why it closed (manual end, logout, idle timeout, or re-login).
        </p>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 font-medium">Started</th>
                <th className="py-2 pr-3 font-medium">Ended</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">End reason</th>
              </tr>
            </thead>
            <tbody>
              {state.sessions.slice(0, 50).map((s) => {
                const emp = state.employees.find((x) => x.id === s.employeeId);
                const reasonLabel =
                  s.endReason === "manual_end"
                    ? "Employee ended session"
                    : s.endReason === "logout"
                      ? "Signed out"
                      : s.endReason === "idle_timeout"
                        ? "Idle auto logout"
                        : s.endReason === "duplicate_login"
                          ? "Replaced by new login"
                          : s.endReason ?? (s.endTime ? "Closed" : "—");
                return (
                  <tr key={s.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{emp?.name ?? s.employeeId}</td>
                    <td className="py-2 pr-3">{formatDateTime(s.startTime)}</td>
                    <td className="py-2 pr-3">
                      {s.endTime ? formatDateTime(s.endTime) : "In progress"}
                    </td>
                    <td className="py-2 pr-3">
                      {formatDuration(minutesBetween(s.startTime, s.endTime))}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge
                        variant={
                          s.status === "active" || s.status === "on_break"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {s.status === "on_break"
                          ? "On break"
                          : s.status === "idle_warning"
                            ? "Idle warning"
                            : s.status}
                      </Badge>
                    </td>
                    <td className="py-2">{reasonLabel}</td>
                  </tr>
                );
              })}
              {state.sessions.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No work sessions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 animate-slide-up stagger-3 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Employee inactivity windows</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          From / to times when an employee had no pointer or keyboard activity (including auto
          logout after the countdown).
        </p>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">Employee</th>
                <th className="py-2 pr-3 font-medium">Inactive from</th>
                <th className="py-2 pr-3 font-medium">Inactive until</th>
                <th className="py-2 pr-3 font-medium">Duration</th>
                <th className="py-2 font-medium">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {state.timeEvents
                .filter((e) => e.type === "idle_signal")
                .slice(0, 50)
                .map((e) => {
                  const emp = state.employees.find((x) => x.id === e.employeeId);
                  const session = state.sessions.find((s) => s.id === e.sessionId);
                  const outcome =
                    session?.endReason === "idle_timeout" &&
                    e.endTime &&
                    session.endTime === e.endTime
                      ? "Auto logout"
                      : e.endTime
                        ? "Resumed / resolved"
                        : "In progress";
                  return (
                    <tr key={e.id} className="border-b border-border/50">
                      <td className="py-2 pr-3">{emp?.name ?? e.employeeId}</td>
                      <td className="py-2 pr-3">{formatDateTime(e.startTime)}</td>
                      <td className="py-2 pr-3">
                        {e.endTime ? formatDateTime(e.endTime) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        {formatDuration(minutesBetween(e.startTime, e.endTime))}
                      </td>
                      <td className="py-2">{outcome}</td>
                    </tr>
                  );
                })}
              {state.timeEvents.filter((e) => e.type === "idle_signal").length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted-foreground">
                    No inactivity windows recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 animate-slide-up stagger-3 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Sensitive action audit log</h2>
        <div className="mt-3 max-h-80 overflow-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">When</th>
                <th className="py-2 pr-3 font-medium">Actor</th>
                <th className="py-2 pr-3 font-medium">Action</th>
                <th className="py-2 font-medium">Target</th>
              </tr>
            </thead>
            <tbody>
              {state.auditLogs.slice(0, 40).map((a) => {
                const actor = state.employees.find((e) => e.id === a.actorId);
                return (
                  <tr key={a.id} className="border-b border-border/50">
                    <td className="py-2 pr-3">{formatDateTime(a.timestamp)}</td>
                    <td className="py-2 pr-3">{actor?.name ?? a.actorId}</td>
                    <td className="py-2 pr-3 font-mono text-xs">{a.action}</td>
                    <td className="py-2 font-mono text-xs">
                      {a.targetType}:{a.targetId}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-white/90 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-heading mt-1 text-3xl font-semibold">{value}</p>
    </div>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["admin"]}>
      <AdminHome />
    </AuthGate>
  );
}
