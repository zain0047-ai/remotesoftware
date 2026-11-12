"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, MonitorSmartphone, Share, Globe } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { InstallAppButton } from "@/components/install-app-button";
import { cn } from "@/lib/utils";

export default function InstallPage() {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-16 top-8 h-64 w-64 rounded-full bg-teal-400/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-slate-400/15 blur-3xl" />
      </div>

      <main className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-4 py-14">
        <div className="space-y-3">
          <p className="font-heading text-4xl font-semibold tracking-tight text-primary sm:text-5xl">
            ClarityTrack
          </p>
          <h1 className="text-2xl font-medium text-foreground sm:text-3xl">
            Install on your browser
          </h1>
          <p className="text-muted-foreground">
            Your company sent you this link. Install ClarityTrack like an app —
            it opens in its own window from Chrome, Edge, or Safari, with your
            login saved for daily work.
          </p>
        </div>

        <div className="rounded-2xl border border-border/80 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(20,32,28,0.4)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <InstallAppButton size="lg" label="Install ClarityTrack app" />
            <Link
              href="/"
              className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}
            >
              Sign in after install
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            On desktop Chrome/Edge the Install button appears when the browser
            is ready. On iPhone use Share → Add to Home Screen.
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="font-heading text-lg font-semibold">Steps</h2>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Globe className="size-3.5" />
              </span>
              <span>
                <strong className="text-foreground">Chrome / Edge (Windows, Mac, Android):</strong>{" "}
                open this page → tap <em>Install ClarityTrack</em> (or the ⊕ /
                Install icon in the address bar) → Confirm. The app icon appears
                on your desktop or app drawer.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Share className="size-3.5" />
              </span>
              <span>
                <strong className="text-foreground">iPhone / iPad (Safari):</strong> Share →{" "}
                <em>Add to Home Screen</em> → Add. Open ClarityTrack from the
                home screen icon.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MonitorSmartphone className="size-3.5" />
              </span>
              <span>
                <strong className="text-foreground">After install:</strong> open the app →
                choose Employee → enter Company ID + email + password your admin
                shared.
              </span>
            </li>
          </ol>
        </section>

        {origin && (
          <p className="text-xs text-muted-foreground">
            Install URL for your company:{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
              {origin}/install
            </code>
          </p>
        )}

        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Download className="size-3.5" />
          Works as a Progressive Web App — no App Store download required.
        </p>
      </main>
    </div>
  );
}
