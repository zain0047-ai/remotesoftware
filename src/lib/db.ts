import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

/**
 * Postgres-backed key/value store (Neon on Vercel).
 *
 * Replaces the old JSON-file store so the app works on serverless hosts
 * that do not have a persistent, writable filesystem.
 *
 * One table holds every document as JSON:
 *   key = "platform"          → platform.json equivalent
 *   key = "tenant:{tenantId}" → each company's store.json equivalent
 *
 * Optimistic concurrency is preserved via an integer `version` column.
 */

let _sql: NeonQueryFunction<false, false> | null = null;

function connectionString(): string {
  const url =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!url || !url.trim()) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL (or POSTGRES_URL) " +
        "to your Neon/Postgres connection string.",
    );
  }
  return url.trim();
}

function sql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  _sql = neon(connectionString());
  return _sql;
}

let schemaReady: Promise<void> | null = null;

/** Create the kv_store table once per process (idempotent). */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const q = sql();
      await q`
        CREATE TABLE IF NOT EXISTS kv_store (
          key text PRIMARY KEY,
          version integer NOT NULL DEFAULT 1,
          updated_at timestamptz NOT NULL DEFAULT now(),
          data jsonb NOT NULL
        )
      `;
    })().catch((err) => {
      // Allow a later retry if the first attempt failed (e.g. cold DB).
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export type KvRow = {
  version: number;
  updatedAt: string;
  data: unknown;
};

export async function kvGet(key: string): Promise<KvRow | null> {
  await ensureSchema();
  const q = sql();
  const rows = (await q`
    SELECT version, updated_at, data FROM kv_store WHERE key = ${key}
  `) as Array<{ version: number; updated_at: string; data: unknown }>;
  if (!rows.length) return null;
  const row = rows[0];
  return {
    version: row.version,
    updatedAt: new Date(row.updated_at).toISOString(),
    data: row.data,
  };
}

/**
 * Upsert a document.
 * - When `expectedVersion` is provided and the row already exists with a
 *   different version, no write happens and `null` is returned (conflict).
 * - Otherwise the row is created (version 1) or its version incremented.
 */
export async function kvPut(
  key: string,
  data: unknown,
  expectedVersion?: number,
): Promise<{ version: number; updatedAt: string } | null> {
  await ensureSchema();
  const q = sql();
  const json = JSON.stringify(data);

  if (expectedVersion != null) {
    const rows = (await q`
      INSERT INTO kv_store (key, version, updated_at, data)
      VALUES (${key}, 1, now(), ${json}::jsonb)
      ON CONFLICT (key) DO UPDATE
        SET version = kv_store.version + 1,
            updated_at = now(),
            data = EXCLUDED.data
        WHERE kv_store.version = ${expectedVersion}
      RETURNING version, updated_at
    `) as Array<{ version: number; updated_at: string }>;
    if (!rows.length) return null; // version conflict
    return {
      version: rows[0].version,
      updatedAt: new Date(rows[0].updated_at).toISOString(),
    };
  }

  const rows = (await q`
    INSERT INTO kv_store (key, version, updated_at, data)
    VALUES (${key}, 1, now(), ${json}::jsonb)
    ON CONFLICT (key) DO UPDATE
      SET version = kv_store.version + 1,
          updated_at = now(),
          data = EXCLUDED.data
    RETURNING version, updated_at
  `) as Array<{ version: number; updated_at: string }>;
  return {
    version: rows[0].version,
    updatedAt: new Date(rows[0].updated_at).toISOString(),
  };
}

/** Overwrite a document and reset its version to 1 (used for resets). */
export async function kvReset(
  key: string,
  data: unknown,
): Promise<{ version: number; updatedAt: string }> {
  await ensureSchema();
  const q = sql();
  const json = JSON.stringify(data);
  const rows = (await q`
    INSERT INTO kv_store (key, version, updated_at, data)
    VALUES (${key}, 1, now(), ${json}::jsonb)
    ON CONFLICT (key) DO UPDATE
      SET version = 1, updated_at = now(), data = EXCLUDED.data
    RETURNING version, updated_at
  `) as Array<{ version: number; updated_at: string }>;
  return {
    version: rows[0].version,
    updatedAt: new Date(rows[0].updated_at).toISOString(),
  };
}

export function tenantKey(tenantId: string): string {
  return `tenant:${tenantId}`;
}

export const PLATFORM_KEY = "platform";
