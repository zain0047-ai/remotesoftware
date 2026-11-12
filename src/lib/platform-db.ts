import { createEmptyPlatform } from "./platform-seed";
import type {
  Company,
  PersistedPlatform,
  PlatformState,
  PlatformUser,
  SubscriptionPlan,
  SubscriptionStatus,
} from "./platform-types";
import { kvGet, kvPut, PLATFORM_KEY } from "./db";

export async function readPlatform(): Promise<PersistedPlatform> {
  const row = await kvGet(PLATFORM_KEY);
  if (!row) {
    const initial = createEmptyPlatform();
    const saved = await kvPut(PLATFORM_KEY, initial.state);
    return {
      version: saved?.version ?? 1,
      updatedAt: saved?.updatedAt ?? initial.updatedAt,
      state: initial.state,
    };
  }
  const state = row.data as PlatformState;
  // Soft-fill newer fields
  if (!state.plans?.length) {
    state.plans = createEmptyPlatform().state.plans;
  }
  if (!state.settings) {
    state.settings = createEmptyPlatform().state.settings;
  }
  return { version: row.version, updatedAt: row.updatedAt, state };
}

export async function writePlatform(
  state: PlatformState,
  expectedVersion?: number,
): Promise<PersistedPlatform> {
  const saved = await kvPut(PLATFORM_KEY, state, expectedVersion);
  if (!saved) {
    const current = await readPlatform();
    const err = new Error("PLATFORM_VERSION_CONFLICT") as Error & {
      code: string;
      store: PersistedPlatform;
    };
    err.code = "PLATFORM_VERSION_CONFLICT";
    err.store = current;
    throw err;
  }
  return { version: saved.version, updatedAt: saved.updatedAt, state };
}

export function findPlan(
  state: PlatformState,
  planIdOrCode: string,
): SubscriptionPlan | undefined {
  return state.plans.find(
    (p) => p.id === planIdOrCode || p.code === planIdOrCode,
  );
}

export function companyBySlug(
  state: PlatformState,
  slug: string,
): Company | undefined {
  const s = slug.toLowerCase().trim();
  return state.companies.find(
    (c) => c.slug === s && c.status !== "deleted",
  );
}

export function companyById(
  state: PlatformState,
  id: string,
): Company | undefined {
  return state.companies.find((c) => c.id === id && c.status !== "deleted");
}

export function isSubscriptionUsable(company: Company): boolean {
  if (company.status === "suspended" || company.status === "inactive") {
    return false;
  }
  if (company.status === "deleted") return false;
  if (
    company.subscriptionStatus === "expired" ||
    company.subscriptionStatus === "suspended"
  ) {
    return false;
  }
  const exp = new Date(company.subscriptionExpiresAt).getTime();
  if (Number.isFinite(exp) && exp < Date.now()) return false;
  return true;
}

/** Company admins may still sign in to renew/view billing when expired. */
export function canCompanyAdminAccess(company: Company): boolean {
  if (company.status === "deleted") return false;
  if (company.status === "suspended") return false;
  return true;
}

export function refreshSubscriptionStatus(company: Company): Company {
  const exp = new Date(company.subscriptionExpiresAt).getTime();
  if (
    Number.isFinite(exp) &&
    exp < Date.now() &&
    company.subscriptionStatus !== "suspended"
  ) {
    return { ...company, subscriptionStatus: "expired" as SubscriptionStatus };
  }
  return company;
}

export function redactPlatformUser(user: PlatformUser) {
  const { password: _p, ...rest } = user;
  return { ...rest, password: "" };
}

export function appendPlatformAudit(
  state: PlatformState,
  entry: Omit<PlatformState["auditLogs"][number], "id" | "timestamp"> & {
    id?: string;
    timestamp?: string;
  },
): PlatformState {
  const log = {
    id: entry.id ?? `paud_${Date.now().toString(36)}`,
    actorId: entry.actorId,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    outcome: entry.outcome,
    detail: entry.detail,
  };
  return {
    ...state,
    auditLogs: [log, ...state.auditLogs].slice(0, 5000),
  };
}
