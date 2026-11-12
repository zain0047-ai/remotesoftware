"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Send,
  Settings2,
  Shield,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const navForRole = {
  employee: [
    { href: "/app", label: "Work session", icon: LayoutDashboard },
    { href: "/app/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/app/meetings", label: "Meetings", icon: Video },
    { href: "/app/reports", label: "Reports", icon: FileText },
  ],
  manager: [
    { href: "/manager", label: "Review queue", icon: ClipboardList },
    { href: "/manager/team", label: "Team time", icon: LayoutDashboard },
    { href: "/manager/tasks", label: "Assign tasks", icon: FileText },
  ],
  admin: [
    { href: "/admin", label: "Admin", icon: Settings2 },
    { href: "/admin/tasks", label: "Work allocation", icon: Send },
    { href: "/admin/meetings", label: "Meetings", icon: Video },
    { href: "/admin/reports", label: "Reports", icon: ClipboardList },
    { href: "/admin/policy", label: "Policy", icon: Shield },
    { href: "/admin/backups", label: "Backups", icon: FileText },
  ],
};

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { currentUser, logout, activeSession, state, company } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  if (!currentUser) {
    return null;
  }

  const links = navForRole[currentUser.role];
  const unread = (state.notifications ?? []).filter(
    (n) => n.userId === currentUser.id && !n.readAt,
  ).length;
  const meetingsHref =
    currentUser.role === "admin" ? "/admin/meetings" : "/app/meetings";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-[#f7faf8]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="font-heading text-xl font-semibold tracking-tight text-primary">
              ClarityTrack
            </Link>
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {currentUser.role}
            </Badge>
            {activeSession && (
              <span className="hidden items-center gap-2 text-xs text-muted-foreground md:inline-flex">
                <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse-soft" />
                Session {activeSession.status.replace("_", " ")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(currentUser.role === "admin" || currentUser.role === "employee") && (
              <Button
                variant="outline"
                size="sm"
                className="relative"
                onClick={() => router.push(meetingsHref)}
                aria-label="Meeting notifications"
              >
                <Bell className="size-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Button>
            )}
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground">
                {company ? `${company.name} · ` : ""}
                {currentUser.team}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
                router.push("/");
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 pb-2">
          {links.map((link) => {
            const Icon = link.icon;
            const active =
              pathname === link.href ||
              (link.href !== "/app" &&
                link.href !== "/admin" &&
                link.href !== "/manager" &&
                pathname.startsWith(`${link.href}/`));
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {link.label}
                {link.label === "Meetings" && unread > 0 && (
                  <span className="rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="font-heading mb-4 text-3xl font-semibold tracking-tight">{title}</h1>
        {children}
      </main>
    </div>
  );
}
