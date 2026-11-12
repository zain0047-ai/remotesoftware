"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, LogOut, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Plan = {
  id: string;
  code: string;
  name: string;
  maxEmployees: number;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  features: string[];
  active: boolean;
};

export default function SuperPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      const me = await fetch("/api/store", { credentials: "include", cache: "no-store" });
      const meData = (await me.json()) as { authenticated?: boolean; kind?: string };
      if (!me.ok || meData.kind !== "super_admin") {
        router.replace("/");
        return;
      }
      const res = await fetch("/api/platform/plans", { credentials: "include" });
      const data = (await res.json()) as { plans?: Plan[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load plans");
        setReady(true);
        return;
      }
      setPlans(data.plans ?? []);
      setReady(true);
    })();
  }, [router]);

  async function savePlan(plan: Plan) {
    setError("");
    const res = await fetch("/api/platform/plans", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(plan),
    });
    const data = (await res.json()) as { plans?: Plan[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setPlans(data.plans ?? []);
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading plans…
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
          <span className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            <Shield className="size-4" />
            Plans
          </span>
          <Link
            href="/super/audit"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            Audit
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <h1 className="font-heading text-3xl font-semibold">Subscription plans</h1>
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
            {error}
          </div>
        )}
        {plans.map((p) => (
          <form
            key={p.id}
            className="grid gap-3 rounded-xl border border-border/70 bg-white p-4 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              void savePlan(p);
            }}
          >
            <div className="sm:col-span-3 flex items-center gap-2">
              <p className="font-medium">{p.name}</p>
              <Badge variant="secondary">{p.code}</Badge>
              {!p.active && <Badge variant="outline">Inactive</Badge>}
            </div>
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={p.name}
                onChange={(e) =>
                  setPlans((all) =>
                    all.map((x) =>
                      x.id === p.id ? { ...x, name: e.target.value } : x,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Max employees</Label>
              <Input
                type="number"
                value={p.maxEmployees}
                onChange={(e) =>
                  setPlans((all) =>
                    all.map((x) =>
                      x.id === p.id
                        ? { ...x, maxEmployees: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Trial days</Label>
              <Input
                type="number"
                value={p.trialDays}
                onChange={(e) =>
                  setPlans((all) =>
                    all.map((x) =>
                      x.id === p.id
                        ? { ...x, trialDays: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Monthly price</Label>
              <Input
                type="number"
                value={p.monthlyPrice}
                onChange={(e) =>
                  setPlans((all) =>
                    all.map((x) =>
                      x.id === p.id
                        ? { ...x, monthlyPrice: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Yearly price</Label>
              <Input
                type="number"
                value={p.yearlyPrice}
                onChange={(e) =>
                  setPlans((all) =>
                    all.map((x) =>
                      x.id === p.id
                        ? { ...x, yearlyPrice: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
            </div>
            <div className="flex items-end">
              <Button type="submit">Save</Button>
            </div>
          </form>
        ))}
      </main>
    </div>
  );
}
