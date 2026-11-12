"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";

/**
 * Pointer/keyboard inactivity:
 * after idleThresholdSeconds → 15s countdown warning with Stay logged in / Log out.
 */
export function IdleMonitor() {
  const {
    activeSession,
    state,
    triggerIdleWarning,
    resolveIdle,
    forceIdleLogout,
  } = useStore();
  const router = useRouter();
  const [graceLeft, setGraceLeft] = useState(0);
  const lastActivity = useRef(Date.now());
  const warned = useRef(false);
  const loggingOut = useRef(false);

  const idleMs = Math.max(5, state.policy.idleThresholdSeconds) * 1000;
  const graceSeconds = Math.max(1, state.policy.gracePeriodSeconds);

  function stayLoggedIn() {
    if (loggingOut.current) return;
    resolveIdle("work");
    warned.current = false;
    lastActivity.current = Date.now();
    setGraceLeft(0);
  }

  function logOutNow() {
    if (loggingOut.current) return;
    loggingOut.current = true;
    setGraceLeft(0);
    forceIdleLogout();
    router.replace("/");
  }

  useEffect(() => {
    if (!activeSession || activeSession.status !== "active") {
      if (activeSession?.status !== "idle_warning") {
        warned.current = false;
      }
      return;
    }

    const bump = () => {
      lastActivity.current = Date.now();
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const desktop = (
      window as Window & {
        claritytrackDesktop?: {
          onSystemIdle?: (
            handler: (payload: { idleSeconds: number }) => void,
          ) => () => void;
        };
      }
    ).claritytrackDesktop;
    const unsubscribeDesktop = desktop?.onSystemIdle?.((payload) => {
      if (payload.idleSeconds < 3) bump();
    });

    const timer = window.setInterval(() => {
      if (warned.current || loggingOut.current) return;
      if (Date.now() - lastActivity.current >= idleMs) {
        warned.current = true;
        setGraceLeft(graceSeconds);
        triggerIdleWarning(new Date(lastActivity.current).toISOString());
      }
    }, 500);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(timer);
      unsubscribeDesktop?.();
    };
  }, [activeSession, idleMs, graceSeconds, triggerIdleWarning]);

  useEffect(() => {
    if (activeSession?.status !== "idle_warning") return;
    if (graceLeft <= 0) return;
    const t = window.setTimeout(() => setGraceLeft((g) => g - 1), 1000);
    return () => window.clearTimeout(t);
  }, [activeSession?.status, graceLeft]);

  // Countdown finished → logout
  useEffect(() => {
    if (activeSession?.status !== "idle_warning") return;
    if (graceLeft > 0) return;
    if (loggingOut.current) return;
    loggingOut.current = true;
    forceIdleLogout();
    router.replace("/");
  }, [activeSession?.status, graceLeft, forceIdleLogout, router]);

  // Reset logout guard when a fresh session starts
  useEffect(() => {
    if (activeSession?.status === "active") {
      loggingOut.current = false;
    }
  }, [activeSession?.status]);

  const open = activeSession?.status === "idle_warning" && graceLeft > 0;

  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-center text-2xl tabular-nums">
            {graceLeft}s
          </DialogTitle>
          <DialogDescription className="text-center">
            No activity detected for a while. Choose an option before the timer reaches zero —
            otherwise you will be signed out automatically.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button className="w-full" onClick={stayLoggedIn}>
            Stay logged in
          </Button>
          <Button className="w-full" variant="outline" onClick={logOutNow}>
            Log out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
