import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

export const SESSION_COOKIE = "clarity_session";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours

const DEV_FALLBACK_SECRET =
  "dev-insecure-session-secret-change-me-0123456789abcdef";

/**
 * Session signing secret.
 *
 * Preference order:
 *  1. SESSION_SECRET env var (recommended; set a long random string).
 *  2. A stable secret derived from the database connection string. The DB URL
 *     is always present on the server and is itself secret/high-entropy, so
 *     this keeps the app working without extra config and stays consistent
 *     across serverless instances and redeploys (no per-instance drift).
 *  3. A fixed dev fallback (non-production only).
 */
export function getSessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const dbUrl = (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    ""
  ).trim();
  if (dbUrl) {
    return createHash("sha256")
      .update(`claritytrack-session-v1:${dbUrl}`)
      .digest("base64url");
  }

  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  throw new Error(
    "SESSION_SECRET must be set to a random string of at least 16 characters.",
  );
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

export type SessionKind = "super_admin" | "tenant";

export type SessionClaims = {
  userId: string;
  exp: number;
  kind: SessionKind;
  /** Set for tenant users; null for super admin */
  tenantId: string | null;
  role: string;
};

export type SessionInput = {
  userId: string;
  kind: SessionKind;
  tenantId: string | null;
  role: string;
};

export function createSessionToken(input: SessionInput): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const body = {
    userId: input.userId,
    exp,
    kind: input.kind,
    tenantId: input.tenantId,
    role: input.role,
  };
  const payload = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  // New format: payload.mac
  if (parts.length === 2) {
    const [payload, mac] = parts;
    if (!payload || !mac) return null;
    const expected = sign(payload);
    const a = Buffer.from(mac);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    try {
      const body = JSON.parse(
        Buffer.from(payload, "base64url").toString("utf8"),
      ) as SessionClaims;
      if (!body.userId || !body.kind || !body.role) return null;
      if (!Number.isFinite(body.exp) || body.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }
      return {
        userId: body.userId,
        exp: body.exp,
        kind: body.kind,
        tenantId: body.tenantId ?? null,
        role: body.role,
      };
    } catch {
      return null;
    }
  }
  // Legacy format userId.exp.mac — rejected (force re-login after upgrade)
  return null;
}

export function readSessionFromRequest(request: Request): SessionClaims | null {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const value = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return verifySessionToken(value);
}

function cookieSecure(request?: Request): boolean {
  if (process.env.COOKIE_SECURE === "1") return true;
  if (process.env.COOKIE_SECURE === "0") return false;
  const proto = request?.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto === "https";
}

export function setSessionCookie(
  response: NextResponse,
  input: SessionInput,
  request?: Request,
) {
  const token = createSessionToken(input);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(request),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(response: NextResponse, request?: Request) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(request),
    path: "/",
    maxAge: 0,
  });
}
