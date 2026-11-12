import { NextResponse } from "next/server";
import {
  generateTemporaryPassword,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { companyBySlug, readPlatform } from "@/lib/platform-db";
import { ensureTenancyMigrated } from "@/lib/migrate-tenancy";
import { readStore, writeStore } from "@/lib/server-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { email?: string; companySlug?: string };

const SENT_MESSAGE =
  "If an account exists for that email, a temporary password has been sent. Check your inbox (and spam).";

const resets = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const row = resets.get(key);
  if (!row || row.resetAt < now) {
    resets.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  row.count += 1;
  return row.count > 5;
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
  const slug = body.companySlug?.toLowerCase().trim() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid work email." },
      { status: 400 },
    );
  }
  if (!slug) {
    return NextResponse.json(
      { error: "Company ID (slug) is required." },
      { status: 400 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (rateLimited(`${ip}:${slug}:${email}`)) {
    return NextResponse.json(
      { error: "Too many reset attempts. Try again later." },
      { status: 429 },
    );
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        error:
          "Password reset email is not configured yet. Add RESEND_API_KEY (and optional EMAIL_FROM) so resets can be delivered to your inbox.",
      },
      { status: 503 },
    );
  }

  const platform = await readPlatform();
  const company = companyBySlug(platform.state, slug);
  if (!company) {
    return NextResponse.json({ ok: true, message: SENT_MESSAGE });
  }

  const store = await readStore(company.id);
  const employee = store.state.employees.find(
    (e) => e.email.toLowerCase() === email,
  );

  if (!employee || employee.status !== "active") {
    return NextResponse.json({ ok: true, message: SENT_MESSAGE });
  }

  const temporaryPassword = generateTemporaryPassword();
  const text = [
    `Hi ${employee.name},`,
    "",
    `You requested a password reset for ClarityTrack (${company.name}).`,
    `Your temporary password is: ${temporaryPassword}`,
    "",
    "Sign in with this password, then change it after you are back in.",
    "",
    "If you did not request this, contact your admin.",
  ].join("\n");

  const html = `
    <div style="font-family:Georgia,serif;line-height:1.5;color:#14201c">
      <p>Hi ${escape(employee.name)},</p>
      <p>You requested a password reset for <strong>ClarityTrack</strong> (${escape(company.name)}).</p>
      <p>Your temporary password is:</p>
      <p style="font-size:20px;letter-spacing:0.04em"><strong>${escape(temporaryPassword)}</strong></p>
      <p>Sign in with this password, then change it once you are back in.</p>
      <p style="color:#5b6b66;font-size:13px">If you did not request this, contact your admin.</p>
    </div>
  `;

  const sent = await sendEmail({
    to: employee.email,
    subject: "ClarityTrack temporary password",
    text,
    html,
  });

  if (!sent.ok) {
    return NextResponse.json(
      {
        error:
          "We could not send the reset email right now. Your current password is unchanged — try again shortly.",
      },
      { status: 502 },
    );
  }

  const employees = store.state.employees.map((e) =>
    e.id === employee.id
      ? { ...e, password: hashPassword(temporaryPassword) }
      : e,
  );
  await writeStore(company.id, {
    ...store.state,
    employees,
    auditLogs: [
      {
        id: `aud_${Date.now().toString(36)}`,
        actorId: employee.id,
        action: "auth.forgot_password",
        targetType: "employee",
        targetId: employee.id,
        timestamp: new Date().toISOString(),
        outcome: "success" as const,
      },
      ...store.state.auditLogs,
    ],
  });

  return NextResponse.json({ ok: true, message: SENT_MESSAGE });
}

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
