import { NextResponse } from "next/server";
import {
  appendPlatformAudit,
  companyById,
  findPlan,
  readPlatform,
  writePlatform,
} from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { resolveSuperAdmin } from "@/lib/request-context";
import { countActiveSeats, readStore } from "@/lib/server-db";
import type { BillingInterval, CompanyStatus, SubscriptionStatus } from "@/lib/platform-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }
  const { id } = await params;
  const platform = await readPlatform();
  const company = companyById(platform.state, id);
  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }
  const store = await readStore(company.id);
  return NextResponse.json({
    company: { ...company, seatCount: await countActiveSeats(company.id) },
    employeeCount: store.state.employees.length,
    plan: findPlan(platform.state, company.planId) ?? null,
  });
}

type PatchBody = {
  name?: string;
  status?: CompanyStatus;
  planCode?: string;
  billingInterval?: BillingInterval;
  maxEmployees?: number;
  subscriptionExpiresAt?: string;
  subscriptionStatus?: SubscriptionStatus;
  notes?: string;
  confirmDelete?: boolean;
};

export async function PATCH(request: Request, { params }: Params) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }
  const { id } = await params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const platform = await readPlatform();
  const existing = platform.state.companies.find((c) => c.id === id);
  if (!existing || existing.status === "deleted") {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  let next = { ...existing, updatedAt: now };

  if (body.name?.trim()) next.name = body.name.trim();
  if (body.notes !== undefined) next.notes = body.notes;
  if (body.maxEmployees && body.maxEmployees > 0) {
    next.maxEmployees = body.maxEmployees;
  }
  if (body.billingInterval) next.billingInterval = body.billingInterval;
  if (body.subscriptionExpiresAt) {
    next.subscriptionExpiresAt = body.subscriptionExpiresAt;
  }
  if (body.subscriptionStatus) {
    next.subscriptionStatus = body.subscriptionStatus;
  }
  if (body.planCode) {
    const plan = findPlan(platform.state, body.planCode);
    if (plan) {
      next.planId = plan.id;
      if (!body.maxEmployees) next.maxEmployees = plan.maxEmployees;
    }
  }
  if (body.status) {
    if (body.status === "deleted") {
      if (!body.confirmDelete) {
        return NextResponse.json(
          { error: "confirmDelete required to delete a company." },
          { status: 400 },
        );
      }
      next = {
        ...next,
        status: "deleted",
        deletedAt: now,
      };
    } else {
      next.status = body.status;
      if (body.status === "active" && next.subscriptionStatus === "suspended") {
        next.subscriptionStatus = "active";
      }
      if (body.status === "suspended") {
        next.subscriptionStatus = "suspended";
      }
    }
  }

  let state = {
    ...platform.state,
    companies: platform.state.companies.map((c) => (c.id === id ? next : c)),
  };
  state = appendPlatformAudit(state, {
    actorId: superCtx.userId,
    action: body.status === "deleted" ? "company.delete" : "company.update",
    targetType: "company",
    targetId: id,
    outcome: "success",
  });
  await writePlatform(state);

  return NextResponse.json({
    ok: true,
    company: { ...next, seatCount: await countActiveSeats(next.id) },
  });
}
