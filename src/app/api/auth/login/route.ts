import { NextResponse } from "next/server";
import { hashPassword, isPasswordHashed, verifyPassword } from "@/lib/password";
import {
  canCompanyAdminAccess,
  companyBySlug,
  isSubscriptionUsable,
  readPlatform,
  refreshSubscriptionStatus,
  writePlatform,
} from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { readStore, writeStore } from "@/lib/server-db";
import { filterStateForReader } from "@/lib/store-access";
import { setSessionCookie } from "@/lib/session";
import { redactPlatformUser } from "@/lib/platform-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  email?: string;
  password?: string;
  portal?: "admin" | "employee" | "super";
  /** Company slug required for tenant logins */
  companySlug?: string;
};

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const row = attempts.get(key);
  if (!row || row.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  row.count += 1;
  return row.count > 20;
}

export async function POST(request: Request) {
  await ensureTenancyMigrated();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = body.email?.toLowerCase().trim() ?? "";
  const password = body.password ?? "";
  const portal = body.portal ?? "employee";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }
  if (rateLimited(`${ip}:${email}`)) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429 },
    );
  }

  // ——— Super Admin ———
  if (portal === "super") {
    const platform = await readPlatform();
    const matched = platform.state.users.find((u) => u.email === email);
    if (!matched || !verifyPassword(password, matched.password)) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }
    if (!isPasswordHashed(matched.password)) {
      const users = platform.state.users.map((u) =>
        u.id === matched.id ? { ...u, password: hashPassword(password) } : u,
      );
      await writePlatform({ ...platform.state, users });
    }
    const response = NextResponse.json({
      ok: true,
      kind: "super_admin",
      user: redactPlatformUser(matched),
    });
    setSessionCookie(
      response,
      {
        userId: matched.id,
        kind: "super_admin",
        tenantId: null,
        role: "super_admin",
      },
      request,
    );
    return response;
  }

  // ——— Company (tenant) user ———
  const slug = body.companySlug?.toLowerCase().trim() ?? "";
  if (!slug) {
    return NextResponse.json(
      { error: "Company ID (slug) is required." },
      { status: 400 },
    );
  }

  const platform = await readPlatform();
  let company = companyBySlug(platform.state, slug);
  if (!company) {
    return NextResponse.json(
      { error: "Invalid email, password, or company." },
      { status: 401 },
    );
  }
  company = refreshSubscriptionStatus(company);

  const store = await readStore(company.id);
  const matched = store.state.employees.find((e) => e.email.toLowerCase() === email);
  if (!matched || !verifyPassword(password, matched.password)) {
    return NextResponse.json(
      { error: "Invalid email, password, or company." },
      { status: 401 },
    );
  }

  if (portal === "admin" && matched.role !== "admin") {
    return NextResponse.json(
      { error: "This account is not an admin. Use Employee login instead." },
      { status: 403 },
    );
  }
  if (portal === "employee" && matched.role === "admin") {
    return NextResponse.json(
      { error: "Admin accounts must use Admin login." },
      { status: 403 },
    );
  }
  if (matched.status === "pending") {
    return NextResponse.json(
      {
        error:
          matched.role === "admin"
            ? "Your admin request is waiting for approval from an existing admin. You cannot sign in yet."
            : "Your registration is waiting for admin approval. You cannot sign in yet.",
      },
      { status: 403 },
    );
  }
  if (matched.status === "rejected") {
    return NextResponse.json(
      {
        error:
          "Your registration was rejected. Contact an admin if this is a mistake.",
      },
      { status: 403 },
    );
  }
  if (matched.status !== "active") {
    return NextResponse.json(
      { error: "This account is disabled. Contact an admin." },
      { status: 403 },
    );
  }

  if (company.status === "suspended" || company.status === "inactive") {
    return NextResponse.json(
      { error: "This company account is not active." },
      { status: 403 },
    );
  }

  const usable = isSubscriptionUsable(company);
  if (!usable) {
    // Company admins may still sign in to renew/view billing.
    if (!(matched.role === "admin" && canCompanyAdminAccess(company))) {
      return NextResponse.json(
        {
          error:
            "Your company subscription has expired. Ask your admin to renew access.",
        },
        { status: 402 },
      );
    }
  }

  const now = new Date().toISOString();
  const endingIds = new Set(
    store.state.sessions
      .filter(
        (s) =>
          s.employeeId === matched.id &&
          (s.status === "active" ||
            s.status === "on_break" ||
            s.status === "idle_warning"),
      )
      .map((s) => s.id),
  );

  let employees = store.state.employees.map((e) =>
    e.id === matched.id
      ? { ...e, presence: "online" as const, lastSeenAt: now }
      : e,
  );

  if (!isPasswordHashed(matched.password)) {
    const hashed = hashPassword(password);
    employees = employees.map((e) =>
      e.id === matched.id ? { ...e, password: hashed } : e,
    );
  }

  const sessions = store.state.sessions.map((s) =>
    endingIds.has(s.id)
      ? {
          ...s,
          status: "interrupted" as const,
          endTime: now,
          endReason: "duplicate_login",
        }
      : s,
  );
  const timeEvents = store.state.timeEvents.map((e) =>
    endingIds.has(e.sessionId) && !e.endTime ? { ...e, endTime: now } : e,
  );

  const nextState = {
    ...store.state,
    employees,
    sessions,
    timeEvents,
    auditLogs: [
      {
        id: `aud_${Date.now().toString(36)}`,
        actorId: matched.id,
        action: "auth.login",
        targetType: "employee",
        targetId: matched.id,
        timestamp: now,
        outcome: "success" as const,
      },
      ...store.state.auditLogs,
    ],
  };

  const saved = await writeStore(company.id, nextState);
  const response = NextResponse.json({
    ok: true,
    kind: "tenant",
    tenantId: company.id,
    company: {
      id: company.id,
      name: company.name,
      slug: company.slug,
      subscriptionStatus: company.subscriptionStatus,
      subscriptionExpiresAt: company.subscriptionExpiresAt,
      maxEmployees: company.maxEmployees,
    },
    currentUserId: matched.id,
    version: saved.version,
    state: filterStateForReader(saved.state, { ...matched, password: "" }),
    subscriptionWarning: !usable,
  });
  setSessionCookie(
    response,
    {
      userId: matched.id,
      kind: "tenant",
      tenantId: company.id,
      role: matched.role,
    },
    request,
  );
  return response;
}
