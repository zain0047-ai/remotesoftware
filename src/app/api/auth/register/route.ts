import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import {
  companyBySlug,
  isSubscriptionUsable,
  readPlatform,
  refreshSubscriptionStatus,
} from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { countActiveSeats, readStore, writeStore } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  email?: string;
  password?: string;
  team?: string;
  role?: "employee" | "admin";
  companySlug?: string;
};

export async function POST(request: Request) {
  await ensureTenancyMigrated();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.toLowerCase().trim() ?? "";
  const password = body.password ?? "";
  const team =
    body.team?.trim() ||
    (body.role === "admin" ? "Administration" : "Unassigned");
  const role = body.role === "admin" ? "admin" : "employee";
  const slug = body.companySlug?.toLowerCase().trim() ?? "";

  if (!slug) {
    return NextResponse.json(
      { error: "Company ID (slug) is required." },
      { status: 400 },
    );
  }
  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter your full name." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid work email." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 },
    );
  }

  const platform = await readPlatform();
  let company = companyBySlug(platform.state, slug);
  if (!company) {
    return NextResponse.json(
      { error: "Unknown company ID." },
      { status: 404 },
    );
  }
  company = refreshSubscriptionStatus(company);
  if (!isSubscriptionUsable(company) || company.status !== "active") {
    return NextResponse.json(
      { error: "This company is not accepting new registrations right now." },
      { status: 403 },
    );
  }

  const seats = await countActiveSeats(company.id);
  if (seats >= company.maxEmployees) {
    return NextResponse.json(
      {
        error: `This company has reached its seat limit (${company.maxEmployees}).`,
      },
      { status: 403 },
    );
  }

  const store = await readStore(company.id);
  const hasAdmin = store.state.employees.some(
    (e) => e.role === "admin" && e.status === "active",
  );
  if (!hasAdmin) {
    return NextResponse.json(
      {
        error:
          "No company admin exists yet. Ask the platform owner to provision this company.",
      },
      { status: 400 },
    );
  }

  if (store.state.employees.some((e) => e.email.toLowerCase() === email)) {
    return NextResponse.json(
      { error: "An account with this email already exists. Sign in instead." },
      { status: 409 },
    );
  }

  const id = `${role === "admin" ? "adm" : "emp"}_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const created = {
    id,
    name,
    email,
    password: hashPassword(password),
    role: role as "admin" | "employee",
    team,
    status: "pending" as const,
    presence: "offline" as const,
    registeredAt: now,
  };

  await writeStore(company.id, {
    ...store.state,
    employees: [created, ...store.state.employees],
    auditLogs: [
      {
        id: `aud_${Date.now().toString(36)}`,
        actorId: id,
        action:
          role === "admin"
            ? "auth.register_admin_pending"
            : "auth.register_pending",
        targetType: "employee",
        targetId: id,
        timestamp: now,
        outcome: "success" as const,
      },
      ...store.state.auditLogs,
    ],
  });

  return NextResponse.json({
    ok: true,
    pending: true,
    version: null,
    state: null,
  });
}
