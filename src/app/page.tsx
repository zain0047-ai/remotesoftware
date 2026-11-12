"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, Clock3, ListChecks, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstallAppButton } from "@/components/install-app-button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Portal = "admin" | "employee" | "super";
type Mode = "signin" | "register" | "forgot";

export default function HomePage() {
  const {
    ready,
    currentUser,
    login,
    register,
    registerAdmin,
    bootstrapAdmin,
    needsPlatformSetup,
    sessionKind,
    refreshFromServer,
  } = useStore();
  const router = useRouter();
  const [portal, setPortal] = useState<Portal>("employee");
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (needsPlatformSetup) setPortal("super");
  }, [ready, needsPlatformSetup]);

  useEffect(() => {
    if (!ready) return;
    if (sessionKind === "super_admin") {
      router.replace("/super");
      return;
    }
    if (!currentUser) return;
    if (currentUser.role === "employee") router.replace("/app");
    else if (currentUser.role === "manager") router.replace("/manager");
    else router.replace("/admin");
  }, [ready, currentUser, sessionKind, router]);

  function clearMessages() {
    setError("");
    setInfo("");
  }

  function switchPortal(next: Portal) {
    setPortal(next);
    setMode("signin");
    clearMessages();
    setPassword("");
    setConfirm("");
    setEmail("");
    setName("");
    setTeam("");
  }

  function switchMode(next: Mode) {
    setMode(next);
    clearMessages();
    setPassword("");
    setConfirm("");
    if (next === "register") {
      setName("");
      setTeam("");
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    if (portal !== "super" && !companySlug.trim()) {
      setError("Enter your Company ID (slug).");
      return;
    }
    const result = await login(
      email,
      password,
      portal,
      portal === "super" ? undefined : companySlug.trim(),
    );
    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }
    if (result.kind === "super_admin") router.replace("/super");
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    if (!companySlug.trim()) {
      setError("Enter your Company ID (slug).");
      return;
    }
    setForgotBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, companySlug: companySlug.trim() }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Could not send reset email. Try again.");
        return;
      }
      await refreshFromServer();
      setInfo(
        data.message ??
          "If an account exists for that email, a temporary password has been sent. Check your inbox (and spam).",
      );
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setForgotBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!companySlug.trim()) {
      setError("Enter your Company ID (slug).");
      return;
    }
    clearMessages();
    const payload = {
      name,
      email,
      password,
      team,
      companySlug: companySlug.trim(),
    };
    const result =
      portal === "admin"
        ? await registerAdmin(payload)
        : await register(payload);
    if (!result.ok) {
      setError(result.error ?? "Registration failed");
      return;
    }
    setInfo(
      portal === "admin"
        ? "Admin request submitted. An existing company admin must approve you before you can sign in."
        : "Registration submitted. A company admin must approve your account before you can sign in.",
    );
    setPassword("");
    setConfirm("");
    setMode("signin");
  }

  async function handlePlatformSetup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    clearMessages();
    const result = await bootstrapAdmin({
      name,
      email,
      password,
      setupSecret,
    });
    if (!result.ok) {
      setError(result.error ?? "Could not create Super Admin");
      return;
    }
    router.replace("/super");
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>Loading ClarityTrack…</p>
        <p className="text-sm">Fetching workspace status.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-slate-400/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(15,107,92,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,107,92,0.06) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
        <section className="animate-slide-up space-y-6">
          <p className="font-heading text-4xl font-semibold tracking-tight text-primary sm:text-5xl md:text-6xl">
            ClarityTrack
          </p>
          <h1 className="max-w-xl text-2xl font-medium leading-snug text-foreground sm:text-3xl">
            Multi-company WFH tracking — each tenant only sees its own data.
          </h1>
          <p className="max-w-lg text-muted-foreground">
            {needsPlatformSetup
              ? "First step: create the platform Super Admin with your SETUP_SECRET, then provision companies."
              : "Sign in with your Company ID. Super Admins use the Super portal to manage tenants and plans."}
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Building2 className="size-4 text-primary" /> Isolated companies
            </span>
            <span className="inline-flex items-center gap-2">
              <Clock3 className="size-4 text-primary" /> Sessions &amp; breaks
            </span>
            <span className="inline-flex items-center gap-2">
              <ListChecks className="size-4 text-primary" /> Tasks &amp; meetings
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" /> Role-based access
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <InstallAppButton label="Install on this browser" />
            <Link
              href="/install"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Employee install guide
            </Link>
          </div>
        </section>

        <section className="relative z-10 animate-slide-up stagger-2 rounded-2xl border border-border/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(20,32,28,0.45)] backdrop-blur">
          {needsPlatformSetup ? (
            <>
              <h2 className="font-heading text-2xl font-semibold">
                Create Super Admin
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Requires the <code className="text-xs">SETUP_SECRET</code> from
                your environment. This account owns the SaaS platform — not a
                company.
              </p>
              <form onSubmit={(e) => void handlePlatformSetup(e)} className="mt-5 space-y-4">
                <Field id="sa-name" label="Full name" value={name} onChange={setName} />
                <Field
                  id="sa-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="username"
                />
                <Field
                  id="sa-secret"
                  label="Setup secret"
                  type="password"
                  value={setupSecret}
                  onChange={setSetupSecret}
                  autoComplete="off"
                />
                <Field
                  id="sa-password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <Field
                  id="sa-confirm"
                  label="Confirm password"
                  type="password"
                  value={confirm}
                  onChange={setConfirm}
                  autoComplete="new-password"
                />
                {error && <p className="text-sm text-rose-700">{error}</p>}
                <Button type="submit" className="w-full">
                  Create Super Admin
                </Button>
              </form>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["employee", "Employee"],
                    ["admin", "Company admin"],
                    ["super", "Super Admin"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => switchPortal(id)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm",
                      portal === id
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === "signin" && (
                <form onSubmit={(e) => void handleLogin(e)} className="mt-5 space-y-4">
                  <h2 className="font-heading text-xl font-semibold">Sign in</h2>
                  {portal !== "super" && (
                    <Field
                      id="company-slug"
                      label="Company ID"
                      value={companySlug}
                      onChange={setCompanySlug}
                      placeholder="acme-corp"
                    />
                  )}
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    autoComplete="username"
                  />
                  <Field
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                  />
                  {error && <p className="text-sm text-rose-700">{error}</p>}
                  {info && <p className="text-sm text-emerald-800">{info}</p>}
                  <Button type="submit" className="w-full">
                    Sign in
                  </Button>
                  {portal !== "super" && (
                    <div className="flex justify-between text-sm">
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={() => switchMode("register")}
                      >
                        Create account
                      </button>
                      <button
                        type="button"
                        className="text-muted-foreground underline"
                        onClick={() => switchMode("forgot")}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </form>
              )}

              {mode === "register" && portal !== "super" && (
                <form onSubmit={(e) => void handleRegister(e)} className="mt-5 space-y-4">
                  <h2 className="font-heading text-xl font-semibold">
                    {portal === "admin" ? "Request company admin" : "Create employee account"}
                  </h2>
                  <Field
                    id="reg-slug"
                    label="Company ID"
                    value={companySlug}
                    onChange={setCompanySlug}
                    placeholder="acme-corp"
                  />
                  <Field id="reg-name" label="Full name" value={name} onChange={setName} />
                  <Field
                    id="reg-email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />
                  <Field id="reg-team" label="Team" value={team} onChange={setTeam} />
                  <Field
                    id="reg-password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                  />
                  <Field
                    id="reg-confirm"
                    label="Confirm password"
                    type="password"
                    value={confirm}
                    onChange={setConfirm}
                  />
                  {error && <p className="text-sm text-rose-700">{error}</p>}
                  {info && <p className="text-sm text-emerald-800">{info}</p>}
                  <Button type="submit" className="w-full">
                    Submit for approval
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-primary underline"
                    onClick={() => switchMode("signin")}
                  >
                    Back to sign in
                  </button>
                </form>
              )}

              {mode === "forgot" && portal !== "super" && (
                <form onSubmit={(e) => void handleForgot(e)} className="mt-5 space-y-4">
                  <h2 className="font-heading text-xl font-semibold">Forgot password</h2>
                  <Field
                    id="forgot-slug"
                    label="Company ID"
                    value={companySlug}
                    onChange={setCompanySlug}
                  />
                  <Field
                    id="forgot-email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />
                  {error && <p className="text-sm text-rose-700">{error}</p>}
                  {info && <p className="text-sm text-emerald-800">{info}</p>}
                  <Button type="submit" className="w-full" disabled={forgotBusy}>
                    {forgotBusy ? "Sending…" : "Send reset email"}
                  </Button>
                  <button
                    type="button"
                    className="text-sm text-primary underline"
                    onClick={() => switchMode("signin")}
                  >
                    Back to sign in
                  </button>
                </form>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
