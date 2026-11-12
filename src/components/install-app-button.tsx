"use client";

import { useEffect, useState } from "react";
import { Download, Check } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)").matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return mq || ios;
}

export function InstallAppButton({
  className,
  size = "default",
  label = "Install ClarityTrack",
}: {
  className?: string;
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function onInstall() {
    if (!deferred) return;
    setBusy(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setDeferred(null);
    } finally {
      setBusy(false);
    }
  }

  if (installed) {
    return (
      <Button type="button" variant="secondary" size={size} className={cn(className)} disabled>
        <Check className="size-4" />
        Installed on this device
      </Button>
    );
  }

  if (deferred) {
    return (
      <Button
        type="button"
        size={size}
        className={cn(className)}
        disabled={busy}
        onClick={() => void onInstall()}
      >
        <Download className="size-4" />
        {busy ? "Opening install…" : label}
      </Button>
    );
  }

  return (
    <Link
      href="/install"
      className={cn(buttonVariants({ variant: "outline", size }), className)}
    >
      <Download className="size-4" />
      How to install
    </Link>
  );
}
