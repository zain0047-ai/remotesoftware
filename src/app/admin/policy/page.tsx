"use client";

import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { useEffect, useState } from "react";

function PolicyPage() {
  const { state, updatePolicy } = useStore();
  const [form, setForm] = useState(state.policy);

  useEffect(() => {
    setForm(state.policy);
  }, [state.policy]);

  return (
    <AppShell title="Inactivity policy">
      <p className="mb-4 text-muted-foreground">
        Employees are not shown monitoring notices. After the idle threshold with no pointer or
        keyboard activity, a short countdown appears; at zero they are signed out. Admins can review
        each inactive window under Admin overview.
      </p>
      <form
        className="animate-slide-up max-w-2xl space-y-4 rounded-xl border border-border/80 bg-white/90 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          updatePolicy({
            ...form,
            idleThresholdSeconds: Number(form.idleThresholdSeconds),
            gracePeriodSeconds: Number(form.gracePeriodSeconds),
            screenshotIntervalMinutes: Number(form.screenshotIntervalMinutes),
            screenshotRetentionDays: Number(form.screenshotRetentionDays),
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Idle before warning (seconds)</Label>
            <Input
              type="number"
              min={5}
              value={form.idleThresholdSeconds}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  idleThresholdSeconds: Number(e.target.value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">Default 45 — no cursor/keyboard activity.</p>
          </div>
          <div className="space-y-2">
            <Label>Countdown before logout (seconds)</Label>
            <Input
              type="number"
              min={1}
              value={form.gracePeriodSeconds}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  gracePeriodSeconds: Number(e.target.value),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              Default 15 — total idle before logout = threshold + countdown (60s).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Screenshot interval (minutes)</Label>
            <Input
              type="number"
              min={1}
              value={form.screenshotIntervalMinutes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  screenshotIntervalMinutes: Number(e.target.value),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Screenshot retention (days)</Label>
            <Input
              type="number"
              min={1}
              value={form.screenshotRetentionDays}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  screenshotRetentionDays: Number(e.target.value),
                }))
              }
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.screenshotEnabled}
            onChange={(e) =>
              setForm((f) => ({ ...f, screenshotEnabled: e.target.checked }))
            }
          />
          Enable screenshot evidence (simulated in this web MVP)
        </label>

        <Button type="submit">Save policy</Button>
      </form>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["admin"]}>
      <PolicyPage />
    </AuthGate>
  );
}
