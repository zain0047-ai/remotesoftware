import { NextResponse } from "next/server";
import { readPlatform } from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { resolveSuperAdmin } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await ensureTenancyMigrated();
  const superCtx = await resolveSuperAdmin(request);
  if (!superCtx) {
    return NextResponse.json({ error: "Super Admin required." }, { status: 403 });
  }
  const platform = await readPlatform();
  return NextResponse.json({
    auditLogs: platform.state.auditLogs.slice(0, 200),
    settings: platform.state.settings,
  });
}
