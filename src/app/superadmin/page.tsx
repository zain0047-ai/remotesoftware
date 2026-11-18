"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthField } from "@/components/auth-field";
import { AuthBackground } from "@/components/auth-background";
import { useStore } from "@/lib/store";

export default function SuperAdminPage() {
  const {
    ready,
    currentUser,
    login,
    bootstrapAdmin,
    needsPlatformSetup,
    sessionKind,
  } = useStore();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result = await login(email, password, "super");
    if (!result.ok) {
      setError(result.error ?? "Login failed");
      return;
    }
    if (result.kind === "super_admin") router.replace("/super");
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    const result = await bootstrapAdmin({ name, email, password, setupSecret });
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
            <ShieldCheck className="size-4 text-primary" /> Super Admin portal
          </p>
        </div>

        <section className="animate-slide-up rounded-2xl border border-border/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(20,32,28,0.45)] backdrop-blur">
          {needsPlatformSetup ? (
            <>
              <h1 className="font-heading text-2xl font-semibold">
                Create Super Admin
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Requires the <code className="text-xs">SETUP_SECRET</code> from
                your environment. This account owns the SaaS platform — not a
                company.
              </p>
              <form onSubmit={(e) => void handleSetup(e)} className="mt-5 space-y-4">
                <AuthField id="sa-name" label="Full name" value={name} onChange={setName} />
                <AuthField
                  id="sa-email"
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="username"
                />
                <AuthField
                  id="sa-secret"
                  label="Setup secret"
                  type="password"
                  value={setupSecret}
                  onChange={setSetupSecret}
                  autoComplete="off"
                />
                <AuthField
                  id="sa-password"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                />
                <AuthField
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
              <h1 className="font-heading text-2xl font-semibold">Super Admin sign in</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Platform owner access — manage companies and plans.
              </p>
              <form onSubmit={(e) => void handleLogin(e)} className="mt-5 space-y-4">
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
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </form>
            </>
          )}
        </section>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/company-admin" className="text-primary underline">
            Company admin portal
          </Link>
        </p>
      </div>
    </div>
  );
}
