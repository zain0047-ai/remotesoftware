import { NextResponse } from "next/server";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { readPlatform } from "@/lib/platform-db";
import { resolveTenantActor, loadSession } from "@/lib/request-context";
import {
  applyAuthorizedWrite,
  filterStateForReader,
  requireRole,
} from "@/lib/store-access";
import { readStore, resetStore, writeStore, type SharedState } from "@/lib/server-db";
import { clearSessionCookie } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureTenancyMigrated();
  const session = await loadSession(request);
  const platform = await readPlatform();

  if (!session) {
    return NextResponse.json(
      {
        authenticated: false,
        kind: null,
        needsPlatformSetup: !platform.state.users.some(
          (u) => u.role === "super_admin",
        ),
        needsAdminSetup: false,
        version: 0,
        state: null,
        currentUserId: null,
        company: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  if (session.kind === "super_admin") {
    const user = platform.state.users.find((u) => u.id === session.userId);
    if (!user) {
      return NextResponse.json(
        { authenticated: false, error: "Session invalid." },
        { status: 401 },
      );
    }
    return NextResponse.json(
      {
        authenticated: true,
        kind: "super_admin",
        needsPlatformSetup: false,
        needsAdminSetup: false,
        version: platform.version,
        state: null,
        currentUserId: user.id,
        superUser: { id: user.id, name: user.name, email: user.email },
        company: null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const resolved = await resolveTenantActor(request, { allowExpiredForAdmin: true });
  if (!resolved.ok) {
    return NextResponse.json(
      { authenticated: false, error: resolved.error },
      { status: resolved.status },
    );
  }
  const { ctx } = resolved;
  return NextResponse.json(
    {
      authenticated: true,
      kind: "tenant",
      needsPlatformSetup: false,
      needsAdminSetup: false,
      version: ctx.storeVersion,
      updatedAt: undefined,
      state: filterStateForReader(ctx.state, ctx.actor),
      currentUserId: ctx.actor.id,
      company: {
        id: ctx.company.id,
        name: ctx.company.name,
        slug: ctx.company.slug,
        subscriptionStatus: ctx.company.subscriptionStatus,
        subscriptionExpiresAt: ctx.company.subscriptionExpiresAt,
        maxEmployees: ctx.company.maxEmployees,
        status: ctx.company.status,
      },
      subscriptionWarning:
        ctx.company.subscriptionStatus === "expired" ||
        ctx.company.subscriptionStatus === "suspended",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(request: Request) {
  await ensureTenancyMigrated();
  const resolved = await resolveTenantActor(request, { allowExpiredForAdmin: true });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { ctx } = resolved;

  // Expired subscription: company admin may only keep presence/logout-like state;
  // block structural writes from non-admins entirely (already gated on login).
  if (
    (ctx.company.subscriptionStatus === "expired" ||
      ctx.company.subscriptionStatus === "suspended") &&
    ctx.actor.role !== "admin"
  ) {
    return NextResponse.json(
      { error: "Subscription expired." },
      { status: 402 },
    );
  }

  try {
    const body = (await request.json()) as {
      state?: SharedState;
      version?: number;
    };
    if (!body.state) {
      return NextResponse.json({ error: "Missing state" }, { status: 400 });
    }

    const merged = applyAuthorizedWrite(ctx.state, body.state, ctx.actor);
    const saved = await writeStore(ctx.company.id, merged, body.version);
    return NextResponse.json({
      authenticated: true,
      kind: "tenant",
      version: saved.version,
      updatedAt: saved.updatedAt,
      state: filterStateForReader(saved.state, ctx.actor),
      currentUserId: ctx.actor.id,
      tenantId: ctx.company.id,
    });
  } catch (e) {
    const err = e as Error & { code?: string; store?: unknown };
    if (err.code === "VERSION_CONFLICT") {
      const conflict = err.store as {
        version: number;
        updatedAt: string;
        state: SharedState;
      };
      return NextResponse.json(
        {
          error: "VERSION_CONFLICT",
          store: {
            version: conflict.version,
            updatedAt: conflict.updatedAt,
            state: filterStateForReader(conflict.state, ctx.actor),
          },
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: err.message || "Write failed" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  await ensureTenancyMigrated();
  const resolved = await resolveTenantActor(request);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { ctx } = resolved;
  if (!requireRole(ctx.actor, ["admin"])) {
    return NextResponse.json({ error: "Admin authentication required." }, { status: 403 });
  }

  const reset = await resetStore(ctx.company.id);
  const response = NextResponse.json({
    authenticated: false,
    kind: "tenant",
    needsAdminSetup: true,
    version: reset.version,
    updatedAt: reset.updatedAt,
    state: null,
    currentUserId: null,
    tenantId: ctx.company.id,
  });
  clearSessionCookie(response, request);
  return response;
}
