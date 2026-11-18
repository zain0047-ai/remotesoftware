"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Clock3,
  ListChecks,
  Monitor,
  ShieldCheck,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { AuthField } from "@/components/auth-field";
import { AuthBackground } from "@/components/auth-background";
import { InstallAppButton } from "@/components/install-app-button";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

type Mode = "signin" | "register" | "forgot";

export default function HomePage() {
  const {
    ready,
    currentUser,
    login,
    register,
    needsPlatformSetup,
    sessionKind,
    refreshFromServer,
  } = useStore();
  const router = useRouter();

  // Desktop employee client loads "/?desktop=1" (see desktop/main.cjs).
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [team, setTeam] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  useEffect(() => {
    setIsDesktop(
      new URLSearchParams(window.location.search).get("desktop") === "1",
    );
  }, []);

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
    if (!companySlug.trim()) {
      setError("Enter your Company ID (slug).");
      return;
    }
    const result = await login(email, password, "employee", companySlug.trim());
    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }
    router.replace("/app");
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
    const result = await register({
      name,
      email,
      password,
      team,
      companySlug: companySlug.trim(),
    });
    if (!result.ok) {
      setError(result.error ?? "Registration failed");
      return;
    }
    setInfo(
      "Registration submitted. A company admin must approve your account before you can sign in.",
    );
    setPassword("");
    setConfirm("");
    setMode("signin");
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

  if (!ready || isDesktop === null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>Loading ClarityTrack…</p>
        <p className="text-sm">Fetching workspace status.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuthBackground />

      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
        <section className="animate-slide-up space-y-6">
          <p className="font-heading text-4xl font-semibold tracking-tight text-primary sm:text-5xl md:text-6xl">
            ClarityTrack
          </p>
          <h1 className="max-w-xl text-2xl font-medium leading-snug text-foreground sm:text-3xl">
            Multi-company WFH tracking — each tenant only sees its own data.
          </h1>
          <p className="max-w-lg text-muted-foreground">
            {isDesktop
              ? "Sign in with your Company ID to start your work session."
              : "Admins manage their workspace in the browser. Employees work from the desktop app."}
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
        </section>

        <section className="relative z-10 animate-slide-up stagger-2 rounded-2xl border border-border/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(20,32,28,0.45)] backdrop-blur">
          {isDesktop ? (
            <EmployeeAuth
              mode={mode}
              switchMode={switchMode}
              companySlug={companySlug}
              setCompanySlug={setCompanySlug}
              name={name}
              setName={setName}
              email={email}
              setEmail={setEmail}
              team={team}
              setTeam={setTeam}
              password={password}
              setPassword={setPassword}
              confirm={confirm}
              setConfirm={setConfirm}
              error={error}
              info={info}
              forgotBusy={forgotBusy}
              onLogin={handleLogin}
              onRegister={handleRegister}
              onForgot={handleForgot}
            />
          ) : (
            <WebPortalChooser needsPlatformSetup={needsPlatformSetup} />
          )}
        </section>
      </div>
    </div>
  );
}

function WebPortalChooser({
  needsPlatformSetup,
}: {
  needsPlatformSetup: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Choose your portal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {needsPlatformSetup
            ? "First step: create the platform Super Admin, then provision companies."
            : "Sign in to manage your workspace."}
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/company-admin"
          className="flex items-center gap-3 rounded-xl border border-border/80 bg-white/70 p-4 transition hover:border-primary/60 hover:bg-white"
        >
          <Building2 className="size-5 text-primary" />
          <div>
            <p className="font-medium">Company admin</p>
            <p className="text-sm text-muted-foreground">
              Approvals, work allocation, meetings, reports.
            </p>
          </div>
        </Link>

        <Link
          href="/superadmin"
          className="flex items-center gap-3 rounded-xl border border-border/80 bg-white/70 p-4 transition hover:border-primary/60 hover:bg-white"
        >
          <ShieldCheck className="size-5 text-primary" />
          <div>
            <p className="font-medium">Super Admin</p>
            <p className="text-sm text-muted-foreground">
              Platform owner — manage companies &amp; plans.
            </p>
          </div>
        </Link>
      </div>

      <div className="rounded-xl border border-dashed border-border/80 bg-secondary/40 p-4">
        <p className="inline-flex items-center gap-2 font-medium">
          <Monitor className="size-4 text-primary" /> Employees
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Employees sign in from the ClarityTrack desktop app, not the browser.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <InstallAppButton label="Install on this browser" />
          <Link
            href="/install"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            Employee install guide
          </Link>
        </div>
      </div>
    </div>
  );
}

function EmployeeAuth({
  mode,
  switchMode,
  companySlug,
  setCompanySlug,
  name,
  setName,
  email,
  setEmail,
  team,
  setTeam,
  password,
  setPassword,
  confirm,
  setConfirm,
  error,
  info,
  forgotBusy,
  onLogin,
  onRegister,
  onForgot,
}: {
  mode: Mode;
  switchMode: (m: Mode) => void;
  companySlug: string;
  setCompanySlug: (v: string) => void;
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  team: string;
  setTeam: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  confirm: string;
  setConfirm: (v: string) => void;
  error: string;
  info: string;
  forgotBusy: boolean;
  onLogin: (e: React.FormEvent) => void;
  onRegister: (e: React.FormEvent) => void;
  onForgot: (e: React.FormEvent) => void;
}) {
  return (
    <>
      <p className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
        <Monitor className="size-4 text-primary" /> Employee desktop app
      </p>

      {mode === "signin" && (
        <form onSubmit={onLogin} className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Sign in</h2>
          <AuthField
            id="company-slug"
            label="Company ID"
            value={companySlug}
            onChange={setCompanySlug}
            placeholder="acme-corp"
          />
          <AuthField
            id="email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            autoComplete="username"
          />
          <AuthField
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
        </form>
      )}

      {mode === "register" && (
        <form onSubmit={onRegister} className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">
            Create employee account
          </h2>
          <AuthField
            id="reg-slug"
            label="Company ID"
            value={companySlug}
            onChange={setCompanySlug}
            placeholder="acme-corp"
          />
          <AuthField id="reg-name" label="Full name" value={name} onChange={setName} />
          <AuthField
            id="reg-email"
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
          />
          <AuthField id="reg-team" label="Team" value={team} onChange={setTeam} />
          <AuthField
            id="reg-password"
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
          />
          <AuthField
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

      {mode === "forgot" && (
        <form onSubmit={onForgot} className="space-y-4">
          <h2 className="font-heading text-xl font-semibold">Forgot password</h2>
          <AuthField
            id="forgot-slug"
            label="Company ID"
            value={companySlug}
            onChange={setCompanySlug}
          />
          <AuthField
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
  );
}
