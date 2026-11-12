import { NextResponse } from "next/server";
import {
  appendPlatformAudit,
  readPlatform,
  writePlatform,
} from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { resolveSuperAdmin } from "@/lib/request-context";
import type { PlanCode, SubscriptionPlan } from "@/lib/platform-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }
  const platform = await readPlatform();
  return NextResponse.json({ plans: platform.state.plans });
}

type Body = {
  id?: string;
  code?: PlanCode;
  name?: string;
  maxEmployees?: number;
  monthlyPrice?: number;
  yearlyPrice?: number;
  trialDays?: number;
  features?: string[];
  active?: boolean;
};

export async function PUT(request: Request) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const platform = await readPlatform();
  let plans = [...platform.state.plans];

  if (body.id) {
    plans = plans.map((p) => {
      if (p.id !== body.id) return p;
      return {
        ...p,
        name: body.name?.trim() || p.name,
        maxEmployees: body.maxEmployees ?? p.maxEmployees,
        monthlyPrice: body.monthlyPrice ?? p.monthlyPrice,
        yearlyPrice: body.yearlyPrice ?? p.yearlyPrice,
        trialDays: body.trialDays ?? p.trialDays,
        features: body.features ?? p.features,
        active: body.active ?? p.active,
      };
    });
  } else {
    if (!body.code || !body.name?.trim()) {
      return NextResponse.json(
        { error: "code and name required for new plan." },
        { status: 400 },
      );
    }
    const plan: SubscriptionPlan = {
      id: `plan_${Date.now().toString(36)}`,
      code: body.code,
      name: body.name.trim(),
      maxEmployees: body.maxEmployees ?? 10,
      monthlyPrice: body.monthlyPrice ?? 0,
      yearlyPrice: body.yearlyPrice ?? 0,
      trialDays: body.trialDays ?? 0,
      features: body.features ?? [],
      active: body.active ?? true,
    };
    plans = [plan, ...plans];
  }

  let state = { ...platform.state, plans };
  state = appendPlatformAudit(state, {
    actorId: superCtx.userId,
    action: body.id ? "plan.update" : "plan.create",
    targetType: "plan",
    targetId: body.id ?? "new",
    outcome: "success",
  });
  await writePlatform(state);
  return NextResponse.json({ ok: true, plans });
}
