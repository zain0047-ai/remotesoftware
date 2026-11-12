import { randomBytes } from "crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { resolveTenantActor } from "@/lib/request-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;

export async function POST(request: Request) {
  await ensureTenancyMigrated();
  const resolved = await resolveTenantActor(request);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: resolved.status });
  }
  const { ctx } = resolved;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      {
        error:
          "File uploads are not configured. Connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN).",
      },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file." }, { status: 400 });
    }
    if (file.size <= 0) {
      return NextResponse.json({ error: "Empty file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large. Max size is 12 MB." },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const id = `up_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
    const safeName = file.name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 120);
    // Tenant-scoped path; Vercel Blob appends a random suffix so URLs are unguessable.
    const pathname = `tenants/${ctx.company.id}/${id}__${safeName}`;

    const blob = await put(pathname, bytes, {
      access: "public",
      contentType: file.type || "application/octet-stream",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      id,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      // Full public Blob URL — referenced directly by task attachments.
      url: blob.url,
      uploadedAt: new Date().toISOString(),
      tenantId: ctx.company.id,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
