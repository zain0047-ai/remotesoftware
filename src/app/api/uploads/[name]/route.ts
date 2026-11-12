import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Legacy endpoint. Uploads are now stored on Vercel Blob and task
 * attachments reference their public Blob URL directly, so this route is
 * no longer used to serve files.
 */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "Uploads are served directly from storage. This endpoint is no longer used.",
    },
    { status: 410 },
  );
}
