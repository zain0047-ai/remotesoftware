/** Platform (SaaS owner) types — separate from per-company AppState. */

export type CompanyStatus = "active" | "inactive" | "suspended" | "deleted";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "expired"
  | "suspended";

export type BillingInterval = "monthly" | "yearly";

export type PlanCode = "trial" | "basic" | "professional" | "enterprise";

export interface SubscriptionPlan {
  id: string;
  code: PlanCode;
  name: string;
  maxEmployees: number;
  monthlyPrice: number;
  yearlyPrice: number;
  trialDays: number;
  features: string[];
  active: boolean;
}

export interface Company {
  /** tenant_id */
  id: string;
  name: string;
  /** URL / login slug, unique */
  slug: string;
  status: CompanyStatus;
  planId: string;
  billingInterval: BillingInterval;
  subscriptionStatus: SubscriptionStatus;
  /** Effective seat cap (may override plan) */
  maxEmployees: number;
  subscriptionStartsAt: string;
  subscriptionExpiresAt: string;
  trialEndsAt?: string;
  adminEmail: string;
  adminName: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  notes?: string;
}

export interface PlatformUser {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "super_admin";
  createdAt: string;
}

export interface PlatformAuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  outcome: "success" | "denied" | "failure";
  detail?: string;
}

export interface PlatformSettings {
  allowCompanySelfSignup: boolean;
  defaultPlanCode: PlanCode;
  requireSetupSecret: boolean;
}

export interface PlatformState {
  setupComplete: boolean;
  users: PlatformUser[];
  companies: Company[];
  plans: SubscriptionPlan[];
  auditLogs: PlatformAuditLog[];
  settings: PlatformSettings;
}

export interface PersistedPlatform {
  version: number;
  updatedAt: string;
  state: PlatformState;
}
