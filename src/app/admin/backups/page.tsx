"use client";

import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

function BackupsPage() {
  const { state, runBackup, runManualBackup } = useStore();
  const [message, setMessage] = useState("");

  function downloadManualBackup() {
    const result = runManualBackup();
    if (!result?.ok) {
      setMessage("Manual backup failed. Sign in as admin and try again.");
      return;
    }
    const blob = new Blob([result.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${result.filename}`);
  }

  return (
    <AppShell title="Backup & restore">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-muted-foreground">
          Manual admin backups only. Download a JSON archive of sessions, tasks, submissions,
          reports, and audit logs (passwords are excluded from the file).
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runBackup}>
            Log backup job
          </Button>
          <Button onClick={downloadManualBackup}>Manual backup download</Button>
        </div>
      </div>
      {message && <p className="mb-4 text-sm text-emerald-700">{message}</p>}

      <section className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Backup jobs</h2>
        <div className="mt-3 space-y-3">
          {state.backups.map((b) => (
            <div
              key={b.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border/60 p-3 text-sm"
            >
              <div>
                <p className="font-medium">{b.scope}</p>
                <p className="text-muted-foreground">
                  Started {formatDateTime(b.startedAt)}
                  {b.completedAt ? ` · completed ${formatDateTime(b.completedAt)}` : ""}
                </p>
                {b.failureReason && (
                  <p className="text-destructive">{b.failureReason}</p>
                )}
              </div>
              <Badge variant="secondary">{b.verificationStatus}</Badge>
            </div>
          ))}
          {state.backups.length === 0 && (
            <p className="rounded-md border border-dashed px-4 py-8 text-center text-muted-foreground">
              No backup jobs yet. Use <strong>Manual backup download</strong> when you need an
              archive.
            </p>
          )}
        </div>
      </section>

      <section className="mt-4 animate-slide-up stagger-2 rounded-xl border border-border/80 bg-white/90 p-5 text-sm">
        <h2 className="font-heading text-lg font-semibold">Restore test plan (MVP)</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Download a manual backup JSON from this page.</li>
          <li>Keep the file in admin-only secure storage (not email with screenshots).</li>
          <li>Restore into staging by replacing the shared store after review.</li>
          <li>Verify session, break, task, and report counts match the export.</li>
        </ol>
      </section>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["admin"]}>
      <BackupsPage />
    </AuthGate>
  );
}
