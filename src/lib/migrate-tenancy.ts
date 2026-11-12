import { hashPassword } from "./password";
import { readPlatform, writePlatform } from "./platform-db";
import { createEmptyPlatform } from "./platform-seed";
import { ensureSchema } from "./db";

let ready: Promise<void> | null = null;

/**
 * Ensure the database schema exists and the platform document is seeded
 * with default plans/settings. Runs once per process.
 *
 * (The old file-based single-tenant migration no longer applies: on a fresh
 * Postgres deployment there is no legacy data/store.json to move.)
 */
export function ensureTenancyMigrated(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await ensureSchema();
      const platform = await readPlatform();
      if (!platform.state.plans?.length) {
        const seed = createEmptyPlatform();
        await writePlatform({ ...platform.state, plans: seed.state.plans });
      }
    })().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

export function verifySetupSecret(provided: string | undefined): boolean {
  const expected = process.env.SETUP_SECRET?.trim();
  if (!expected || expected.length < 8) {
    // No secret configured: only allow bootstrap in non-production with the
    // well-known local value.
    if (process.env.NODE_ENV !== "production" && provided === "local-dev-only") {
      return true;
    }
    return false;
  }
  return provided === expected;
}

export function hashIfNeeded(password: string): string {
  return hashPassword(password);
}
