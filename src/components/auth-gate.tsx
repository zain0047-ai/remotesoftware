"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

export function AuthGate({
  children,
  roles,
}: {
  children: React.ReactNode;
  roles?: Role[];
}) {
  const { ready, currentUser, needsAdminSetup } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!currentUser) {
      router.replace("/");
      return;
    }
    if (roles && !roles.includes(currentUser.role)) {
      if (currentUser.role === "employee") router.replace("/app");
      else if (currentUser.role === "manager") router.replace("/manager");
      else router.replace("/admin");
    }
  }, [ready, currentUser, roles, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading workspace…
      </div>
    );
  }

  // Accounts were wiped or session expired — leave protected routes immediately.
  if (!currentUser) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 px-4 text-center text-muted-foreground">
        <p>{needsAdminSetup ? "No accounts yet — set up the first admin." : "Signing you out…"}</p>
        <p className="text-sm">Redirecting to the login page.</p>
      </div>
    );
  }

  if (roles && !roles.includes(currentUser.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Opening your workspace…
      </div>
    );
  }

  return <>{children}</>;
}
