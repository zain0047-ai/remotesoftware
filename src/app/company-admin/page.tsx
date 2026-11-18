"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth-field";
import { AuthBackground } from "@/components/auth-background";
import { useStore } from "@/lib/store";

type Mode = "signin" | "register" | "forgot";

export default function CompanyAdminPage() {
  const {
    ready,
    currentUser,
    login,
    registerAdmin,
    sessionKind,
    refreshFromServer,
  } = useStore();
  const router = useRouter();

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
    const result = await login(email, password, "admin", companySlug.trim());
    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }
    router.replace("/admin");
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
    const result = await registerAdmin({
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
      "Admin request submitted. An existing company admin must approve you before you can sign in.",
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

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 text-muted-foreground">
        <p>Loading ClarityTrack…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <AuthBackground />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-6 text-center">
          <p className="font-heading text-3xl font-semibold tracking-tight text-primary">
            ClarityTrack
          </p>
          <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Building2 className="size-4 text-primary" /> Company admin portal
          </p>
        </div>

        <section className="animate-slide-up rounded-2xl border border-border/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(20,32,28,0.45)] backdrop-blur">
          {mode === "signin" && (
            <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
              <h1 className="font-heading text-xl font-semibold">Sign in</h1>
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
                  Request admin access
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
            <form onSubmit={(e) => void handleRegister(e)} className="space-y-4">
              <h1 className="font-heading text-xl font-semibold">
                Request company admin
              </h1>
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
            <form onSubmit={(e) => void handleForgot(e)} className="space-y-4">
              <h1 className="font-heading text-xl font-semibold">Forgot password</h1>
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
        </section>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/superadmin" className="text-primary underline">
            Super Admin portal
          </Link>
          {" · "}
          <Link href="/" className="text-primary underline">
            Home
          </Link>
        </p>
      </div>
    </div>
  );
}
