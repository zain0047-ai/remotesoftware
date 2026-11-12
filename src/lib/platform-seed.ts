import type { PersistedPlatform, SubscriptionPlan } from "./platform-types";

export function defaultPlans(): SubscriptionPlan[] {
  const now = Date.now().toString(36);
  return [
    {
      id: `plan_trial_${now}`,
      code: "trial",
      name: "Free Trial",
      maxEmployees: 5,
      monthlyPrice: 0,
      yearlyPrice: 0,
      trialDays: 14,
      features: [
        "Sessions & idle tracking",
        "Tasks & meetings",
        "Basic reports",
      ],
      active: true,
    },
    {
      id: `plan_basic_${now}`,
      code: "basic",
      name: "Basic",
      maxEmployees: 25,
      monthlyPrice: 49,
      yearlyPrice: 490,
      trialDays: 0,
      features: [
        "Everything in Trial",
        "Work allocation board",
        "Manual backups",
      ],
      active: true,
    },
    {
      id: `plan_pro_${now}`,
      code: "professional",
      name: "Professional",
      maxEmployees: 100,
      monthlyPrice: 149,
      yearlyPrice: 1490,
      trialDays: 0,
      features: [
        "Everything in Basic",
        "Managers",
        "Advanced date-range reports",
        "Priority support",
      ],
      active: true,
    },
    {
      id: `plan_ent_${now}`,
      code: "enterprise",
      name: "Enterprise",
      maxEmployees: 1000,
      monthlyPrice: 399,
      yearlyPrice: 3990,
      trialDays: 0,
      features: [
        "Everything in Professional",
        "Custom seat limits",
        "Dedicated onboarding",
      ],
      active: true,
    },
  ];
}

export function createEmptyPlatform(): PersistedPlatform {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    state: {
      setupComplete: false,
      users: [],
      companies: [],
      plans: defaultPlans(),
      auditLogs: [],
      settings: {
        allowCompanySelfSignup: false,
        defaultPlanCode: "trial",
        requireSetupSecret: true,
      },
    },
  };
}
