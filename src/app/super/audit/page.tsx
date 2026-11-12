"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/time";

type Log = {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  outcome: string;
  detail?: string;
};

export default function SuperAuditPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<Log[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/store", { credentials: "include", cache: "no-store" });
      const meData = (await me.json()) as { kind?: string };
      if (meData.kind !== "super_admin") {
        router.replace("/");
        return;
      }
      const res = await fetch("/api/platform/audit", { credentials: "include" });
      const data = (await res.json()) as { auditLogs?: Log[] };
      setLogs(data.auditLogs ?? []);
      setReady(true);
    })();
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading audit…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-[#f7faf8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/super" className="font-heading text-xl font-semibold text-primary">
            ClarityTrack
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
              router.replace("/");
            }}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
          <Link
            href="/super"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Building2 className="size-4" />
            Companies
          </Link>
          <Link
            href="/super/plans"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Shield className="size-4" />
            Plans
          </Link>
          <span className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            Audit
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-heading mb-4 text-3xl font-semibold">Platform audit</h1>
        <div className="space-y-2">
          {logs.map((l) => (
            <div
              key={l.id}
              className="rounded-lg border border-border/70 bg-white px-3 py-2 text-sm"
            >
              <p className="font-medium">
                {l.action}{" "}
                <span className="text-muted-foreground">
                  → {l.targetType}/{l.targetId}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(l.timestamp)} · actor {l.actorId} · {l.outcome}
                {l.detail ? ` · ${l.detail}` : ""}
              </p>
            </div>
          ))}
          {logs.length === 0 && (
            <p className="text-muted-foreground">No platform audit events yet.</p>
          )}
        </div>
      </main>
    </div>
  );
}
