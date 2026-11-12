import { existsSync, mkdirSync, renameSync } from "fs";
import { join } from "path";

export function dataDir() {
  return process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0
    ? process.env.DATA_DIR
    : join(process.cwd(), "data");
}

export function tenantRoot(tenantId: string) {
  const safe = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return join(dataDir(), "tenants", safe);
}

export function tenantStorePath(tenantId: string) {
  return join(tenantRoot(tenantId), "store.json");
}

export function tenantUploadsDir(tenantId: string) {
  const dir = join(tenantRoot(tenantId), "uploads");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export function legacyStorePath() {
  return join(dataDir(), "store.json");
}

export function legacyUploadsDir() {
  return join(dataDir(), "uploads");
}

/** Move legacy single-tenant store into a tenant folder (best-effort). */
export function migrateLegacyStoreFile(tenantId: string) {
  const legacy = legacyStorePath();
  const dest = tenantStorePath(tenantId);
  if (!existsSync(legacy) || existsSync(dest)) return false;
  mkdirSync(tenantRoot(tenantId), { recursive: true });
  renameSync(legacy, dest);
  const legacyUp = legacyUploadsDir();
  const destUp = join(tenantRoot(tenantId), "uploads");
  if (existsSync(legacyUp) && !existsSync(destUp)) {
    renameSync(legacyUp, destUp);
  }
  return true;
}
