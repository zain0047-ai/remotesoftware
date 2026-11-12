"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  LogOut,
  Plus,
  RefreshCw,
  Shield,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: string;
  maxEmployees: number;
  seatCount: number;
  adminEmail: string;
  planId: string;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  maxEmployees: number;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  active: boolean;
};

export default function SuperAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [superUser, setSuperUser] = useState<{ name: string; email: string } | null>(
    null,
  );
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState({
    totalCompanies: 0,
    activeCompanies: 0,
    inactiveCompanies: 0,
    totalEmployees: 0,
  });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [planCode, setPlanCode] = useState("trial");
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [maxEmployees, setMaxEmployees] = useState("");

  const refresh = useCallback(async () => {
    const me = await fetch("/api/store", { credentials: "include", cache: "no-store" });
    const meData = (await me.json()) as {
      authenticated?: boolean;
      kind?: string;
      superUser?: { name: string; email: string };
    };
    if (!me.ok || !meData.authenticated || meData.kind !== "super_admin") {
      setAuthorized(false);
      setReady(true);
      return;
    }
    setAuthorized(true);
    setSuperUser(meData.superUser ?? null);

    const res = await fetch("/api/platform/companies", { credentials: "include" });
    if (!res.ok) {
      setError("Could not load companies.");
      setReady(true);
      return;
    }
    const data = (await res.json()) as {
      companies: CompanyRow[];
      plans: Plan[];
      stats: typeof stats;
    };
    setCompanies(data.companies);
    setPlans(data.plans);
    setStats(data.stats);
    if (data.plans[0] && !planCode) setPlanCode(data.plans[0].code);
    setReady(true);
  }, [planCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (ready && !authorized) router.replace("/");
  }, [ready, authorized, router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.replace("/");
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    const res = await fetch("/api/platform/companies", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: slug || undefined,
        planCode,
        billingInterval,
        adminName,
        adminEmail,
        adminPassword,
        maxEmployees: maxEmployees ? Number(maxEmployees) : undefined,
      }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      company?: CompanyRow;
      loginHint?: { companySlug: string };
    };
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Could not create company.");
      return;
    }
    setInfo(
      `Company created. Admin signs in with Company ID “${data.loginHint?.companySlug}”.`,
    );
    setShowCreate(false);
    setName("");
    setSlug("");
    setAdminName("");
    setAdminEmail("");
    setAdminPassword("");
    setMaxEmployees("");
    await refresh();
  }

  async function patchCompany(
    id: string,
    body: Record<string, unknown>,
  ) {
    setError("");
    const res = await fetch(`/api/platform/companies/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setError(data.error ?? "Update failed.");
      return;
    }
    await refresh();
  }

  if (!ready || !authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading Super Admin…
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-[#f7faf8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/super" className="font-heading text-xl font-semibold text-primary">
              ClarityTrack
            </Link>
            <Badge>Super Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{superUser?.name}</p>
              <p className="text-xs text-muted-foreground">{superUser?.email}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
          <span className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            <Building2 className="size-4" />
            Companies
          </span>
          <Link
            href="/super/plans"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            <Shield className="size-4" />
            Plans
          </Link>
          <Link
            href="/super/audit"
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            Audit
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Companies
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="size-4" />
              New company
            </Button>
          </div>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Companies" value={String(stats.totalCompanies)} />
          <Stat label="Active" value={String(stats.activeCompanies)} />
          <Stat label="Inactive / other" value={String(stats.inactiveCompanies)} />
          <Stat label="Seats in use" value={String(stats.totalEmployees)} />
        </div>

        {(error || info) && (
          <div
            className={`mb-4 rounded-lg border px-3 py-2 text-sm ${
              error
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
          >
            {error || info}
          </div>
        )}

        {showCreate && (
          <form
            onSubmit={(e) => void createCompany(e)}
            className="mb-6 grid gap-3 rounded-xl border border-border/70 bg-white p-4 sm:grid-cols-2"
          >
            <h2 className="font-heading text-lg font-semibold sm:col-span-2">
              Create company + company admin
            </h2>
            <div className="space-y-1">
              <Label>Company name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Company ID (slug)</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-corp"
              />
            </div>
            <div className="space-y-1">
              <Label>Plan</Label>
              <Select value={planCode} onValueChange={(v) => v && setPlanCode(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {plans.filter((p) => p.active).map((p) => (
                    <SelectItem key={p.id} value={p.code}>
                      {p.name} ({p.maxEmployees} seats)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Billing</Label>
              <Select
                value={billingInterval}
                onValueChange={(v) =>
                  v && setBillingInterval(v as "monthly" | "yearly")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Seat limit override (optional)</Label>
              <Input
                type="number"
                min={1}
                value={maxEmployees}
                onChange={(e) => setMaxEmployees(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Admin name</Label>
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Admin email</Label>
              <Input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Admin password</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit">Provision company</Button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-border/70 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Company</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Subscription</th>
                <th className="px-3 py-2">Seats</th>
                <th className="px-3 py-2">Admin</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="px-3 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ID: {c.slug}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Badge variant="secondary">{c.status}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    <p>{c.subscriptionStatus}</p>
                    <p className="text-xs text-muted-foreground">
                      Exp {new Date(c.subscriptionExpiresAt).toLocaleDateString()}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    {c.seatCount}/{c.maxEmployees}
                  </td>
                  <td className="px-3 py-3 text-xs">{c.adminEmail}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void patchCompany(c.id, { status: "suspended" })
                          }
                        >
                          Suspend
                        </Button>
                      )}
                      {(c.status === "suspended" || c.status === "inactive") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void patchCompany(c.id, {
                              status: "active",
                              subscriptionStatus: "active",
                            })
                          }
                        >
                          Reactivate
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const days = window.prompt(
                            "Extend subscription by how many days?",
                            "30",
                          );
                          if (!days) return;
                          const exp = new Date(c.subscriptionExpiresAt);
                          exp.setDate(exp.getDate() + Number(days));
                          void patchCompany(c.id, {
                            subscriptionExpiresAt: exp.toISOString(),
                            subscriptionStatus: "active",
                            status: "active",
                          });
                        }}
                      >
                        Extend
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Soft-delete ${c.name}? Tenant data is retained on disk.`,
                            )
                          ) {
                            return;
                          }
                          void patchCompany(c.id, {
                            status: "deleted",
                            confirmDelete: true,
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {companies.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-10 text-center text-muted-foreground"
                  >
                    No companies yet. Create one to provision a company admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-white px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="font-heading mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
