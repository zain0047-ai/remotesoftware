import {
  canCompanyAdminAccess,
  companyById,
  isSubscriptionUsable,
  readPlatform,
  refreshSubscriptionStatus,
} from "./platform-db";
import { ensureTenancyMigrated } from "./migrate-tenancy";
import { findActor } from "./store-access";
import { readStore } from "./server-db";
import { readSessionFromRequest, type SessionClaims } from "./session";
import type { Company } from "./platform-types";
import type { Employee } from "./types";
import type { SharedState } from "./server-db";

export type TenantContext = {
  session: SessionClaims;
  company: Company;
  actor: Employee;
  storeVersion: number;
  state: SharedState;
};

export type SuperContext = {
  session: SessionClaims;
  userId: string;
  email: string;
  name: string;
};

export async function loadSession(request: Request): Promise<SessionClaims | null> {
  await ensureTenancyMigrated();
  return readSessionFromRequest(request);
}

export async function resolveSuperAdmin(
  request: Request,
): Promise<SuperContext | null> {
  const session = await loadSession(request);
  if (!session || session.kind !== "super_admin") return null;
  const platform = await readPlatform();
  const user = platform.state.users.find((u) => u.id === session.userId);
  if (!user) return null;
  return {
    session,
    userId: user.id,
    email: user.email,
    name: user.name,
  };
}

/**
 * Resolve tenant actor from cookie. Never trusts client-supplied tenantId.
 * `allowExpiredForAdmin`: company admins can access billing when expired.
 */
export async function resolveTenantActor(
  request: Request,
  opts?: { allowExpiredForAdmin?: boolean },
): Promise<
  | { ok: true; ctx: TenantContext }
  | { ok: false; status: number; error: string }
> {
  const session = await loadSession(request);
  if (!session || session.kind !== "tenant" || !session.tenantId) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  const platform = await readPlatform();
  let company = companyById(platform.state, session.tenantId);
  if (!company) {
    return { ok: false, status: 403, error: "Company not found." };
  }
  company = refreshSubscriptionStatus(company);

  const store = await readStore(company.id);
  const actor = findActor(store.state, session.userId);
  if (!actor) {
    return { ok: false, status: 401, error: "Authentication required." };
  }

  if (company.status === "deleted") {
    return { ok: false, status: 403, error: "This company has been removed." };
  }
  if (company.status === "suspended") {
    return {
      ok: false,
      status: 403,
      error: "This company is suspended. Contact the platform owner.",
    };
  }
  if (company.status === "inactive") {
    return {
      ok: false,
      status: 403,
      error: "This company is inactive.",
    };
  }

  const usable = isSubscriptionUsable(company);
  if (!usable) {
    const adminBypass =
      opts?.allowExpiredForAdmin &&
      actor.role === "admin" &&
      canCompanyAdminAccess(company);
    if (!adminBypass) {
      return {
        ok: false,
        status: 402,
        error:
          "Subscription expired or inactive. Ask your company admin to renew.",
      };
    }
  }

  return {
    ok: true,
    ctx: {
      session,
      company,
      actor,
      storeVersion: store.version,
      state: store.state,
    },
  };
}
