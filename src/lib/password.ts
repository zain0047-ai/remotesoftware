import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

const PREFIX = "scrypt$";
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

/** Hash a password for storage. Never store plaintext. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, KEYLEN, { N, r: R, p: P }).toString(
    "base64url",
  );
  return `${PREFIX}${N}$${R}$${P}$${salt}$${hash}`;
}

export function isPasswordHashed(value: string): boolean {
  return value.startsWith(PREFIX);
}

/**
 * Verify a password against a stored value.
 * Supports legacy plaintext rows (migrated on next successful login).
 */
export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (!isPasswordHashed(stored)) {
    const a = Buffer.from(password);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
  const parts = stored.split("$");
  // scrypt $ N $ r $ p $ salt $ hash
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = parts[4];
  const expected = parts[5];
  if (!n || !r || !p || !salt || !expected) return false;
  const actual = scryptSync(password, salt, KEYLEN, { N: n, r, p }).toString(
    "base64url",
  );
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
