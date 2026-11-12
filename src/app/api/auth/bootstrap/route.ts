import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import {
  appendPlatformAudit,
  readPlatform,
  writePlatform,
} from "@/lib/platform-db";
import {
  ensureTenancyMigrated,
  verifySetupSecret,
} from "@/lib/migrate-tenancy";
import { setSessionCookie } from "@/lib/session";
import { redactPlatformUser } from "@/lib/platform-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  name?: string;
  email?: string;
  password?: string;
  setupSecret?: string;
};

/**
 * Creates the first Super Admin only.
 * Requires SETUP_SECRET (or local-dev-only in non-production).
 * Does NOT create a company admin — Super Admin provisions companies.
 */
export async function POST(request: Request) {
  await ensureTenancyMigrated();
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!verifySetupSecret(body.setupSecret)) {
    return NextResponse.json(
      {
        error:
          "Invalid or missing setup secret. Set SETUP_SECRET in the environment and pass it here.",
      },
      { status: 403 },
    );
  }

  const name = body.name?.trim() ?? "";
  const email = body.email?.toLowerCase().trim() ?? "";
  const password = body.password ?? "";

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
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const platform = await readPlatform();
  if (platform.state.users.some((u) => u.role === "super_admin")) {
    return NextResponse.json(
      { error: "Platform setup is already complete." },
      { status: 403 },
    );
  }
  if (platform.state.users.some((u) => u.email === email)) {
    return NextResponse.json(
      { error: "This email is already registered." },
      { status: 409 },
    );
  }

  const id = `sa_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const user = {
    id,
    name,
    email,
    password: hashPassword(password),
    role: "super_admin" as const,
    createdAt: now,
  };

  let state = {
    ...platform.state,
    setupComplete: true,
    users: [user, ...platform.state.users],
  };
  state = appendPlatformAudit(state, {
    actorId: id,
    action: "platform.bootstrap_super_admin",
    targetType: "platform_user",
    targetId: id,
    outcome: "success",
  });
  await writePlatform(state);

  const response = NextResponse.json({
    ok: true,
    kind: "super_admin",
    user: redactPlatformUser(user),
  });
  setSessionCookie(
    response,
    { userId: id, kind: "super_admin", tenantId: null, role: "super_admin" },
    request,
  );
  return response;
}
