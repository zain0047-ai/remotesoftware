import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import {
  appendPlatformAudit,
  companyBySlug,
  findPlan,
  readPlatform,
  writePlatform,
} from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { resolveSuperAdmin } from "@/lib/request-context";
import { countActiveSeats, readStore, writeStore } from "@/lib/server-db";
import { createSeedState } from "@/lib/seed";
import type { BillingInterval, Company } from "@/lib/platform-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export async function GET(request: Request) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }
  const platform = await readPlatform();
  const companies = await Promise.all(
    platform.state.companies
      .filter((c) => c.status !== "deleted")
      .map(async (c) => ({
        ...c,
        seatCount: await countActiveSeats(c.id),
      })),
  );
  return NextResponse.json({
    companies,
    plans: platform.state.plans,
    stats: {
      totalCompanies: companies.length,
      activeCompanies: companies.filter((c) => c.status === "active").length,
      inactiveCompanies: companies.filter((c) => c.status !== "active").length,
      totalEmployees: companies.reduce((n, c) => n + c.seatCount, 0),
    },
  });
}

type CreateBody = {
  name?: string;
  slug?: string;
  planCode?: string;
  billingInterval?: BillingInterval;
  adminName?: string;
  adminEmail?: string;
  adminPassword?: string;
  maxEmployees?: number;
  trialDays?: number;
};

export async function POST(request: Request) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const name = body.name?.trim() ?? "";
  const slug = slugify(body.slug || name);
  const adminName = body.adminName?.trim() ?? "";
  const adminEmail = body.adminEmail?.toLowerCase().trim() ?? "";
  const adminPassword = body.adminPassword ?? "";
  const billingInterval: BillingInterval =
    body.billingInterval === "yearly" ? "yearly" : "monthly";

  if (name.length < 2) {
    return NextResponse.json({ error: "Company name is required." }, { status: 400 });
  }
  if (!slug) {
    return NextResponse.json({ error: "Company slug is required." }, { status: 400 });
  }
  if (adminName.length < 2 || !adminEmail || adminPassword.length < 8) {
    return NextResponse.json(
      {
        error:
          "Company admin name, email, and password (8+ chars) are required.",
      },
      { status: 400 },
    );
  }

  const platform = await readPlatform();
  if (companyBySlug(platform.state, slug)) {
    return NextResponse.json(
      { error: "That company slug is already taken." },
      { status: 409 },
    );
  }

  const plan =
    findPlan(platform.state, body.planCode || platform.state.settings.defaultPlanCode) ||
    platform.state.plans[0];
  if (!plan) {
    return NextResponse.json({ error: "No subscription plan configured." }, { status: 500 });
  }

  const now = new Date();
  const expires = new Date(now);
  const trialDays = body.trialDays ?? plan.trialDays;
  if (plan.code === "trial" || trialDays > 0) {
    expires.setDate(expires.getDate() + (trialDays || 14));
  } else if (billingInterval === "yearly") {
    expires.setFullYear(expires.getFullYear() + 1);
  } else {
    expires.setMonth(expires.getMonth() + 1);
  }

  const tenantId = `co_${Date.now().toString(36)}`;
  const company: Company = {
    id: tenantId,
    name,
    slug,
    status: "active",
    planId: plan.id,
    billingInterval,
    subscriptionStatus: plan.code === "trial" || trialDays > 0 ? "trialing" : "active",
    maxEmployees: body.maxEmployees ?? plan.maxEmployees,
    subscriptionStartsAt: now.toISOString(),
    subscriptionExpiresAt: expires.toISOString(),
    trialEndsAt:
      plan.code === "trial" || trialDays > 0 ? expires.toISOString() : undefined,
    adminEmail,
    adminName,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Provision empty tenant store + company admin (active immediately)
  const { currentUserId: _c, ...seedShared } = createSeedState();
  const adminId = `adm_${Date.now().toString(36)}`;
  await writeStore(tenantId, {
    ...seedShared,
    employees: [
      {
        id: adminId,
        name: adminName,
        email: adminEmail,
        password: hashPassword(adminPassword),
        role: "admin",
        team: "Administration",
        status: "active",
        presence: "offline",
        registeredAt: now.toISOString(),
        reviewedAt: now.toISOString(),
        reviewedBy: superCtx.userId,
      },
    ],
    auditLogs: [
      {
        id: `aud_${Date.now().toString(36)}`,
        actorId: superCtx.userId,
        action: "company.provisioned",
        targetType: "employee",
        targetId: adminId,
        timestamp: now.toISOString(),
        outcome: "success",
      },
    ],
  });

  // Verify store readable
  await readStore(tenantId);

  let state = {
    ...platform.state,
    companies: [company, ...platform.state.companies],
  };
  state = appendPlatformAudit(state, {
    actorId: superCtx.userId,
    action: "company.create",
    targetType: "company",
    targetId: tenantId,
    outcome: "success",
    detail: `slug=${slug}`,
  });
  await writePlatform(state);

  return NextResponse.json({
    ok: true,
    company,
    admin: { id: adminId, email: adminEmail, name: adminName },
    loginHint: {
      companySlug: slug,
      portal: "admin",
    },
  });
}
