import type { MonitoringPolicy } from "./types";

const DEFAULT_NOTICE =
  "Monitoring is active during your work session. The company may record session times, break/idle signals, task submissions, and (when enabled) screenshot evidence at the configured interval.";

/** Defaults: 45s idle → 15s warning → logout at 60s total inactivity. */
export function defaultPolicy(): MonitoringPolicy {
  return {
    idleThresholdSeconds: 45,
    gracePeriodSeconds: 15,
    screenshotEnabled: true,
    screenshotIntervalMinutes: 10,
    screenshotRetentionDays: 30,
    allowLowInputWork: true,
    monitoringNotice: DEFAULT_NOTICE,
  };
}

/** Migrate older stores that used idleThresholdMinutes. */
export function normalizePolicy(
  raw: Partial<MonitoringPolicy> & { idleThresholdMinutes?: number } | null | undefined,
): MonitoringPolicy {
  const base = defaultPolicy();
  if (!raw) return base;

  const fromMinutes =
    typeof raw.idleThresholdMinutes === "number"
      ? Math.round(raw.idleThresholdMinutes * 60)
      : undefined;

  return {
    idleThresholdSeconds:
      typeof raw.idleThresholdSeconds === "number" && raw.idleThresholdSeconds > 0
        ? raw.idleThresholdSeconds
        : fromMinutes && fromMinutes > 0
          ? fromMinutes
          : base.idleThresholdSeconds,
    gracePeriodSeconds:
      typeof raw.gracePeriodSeconds === "number" && raw.gracePeriodSeconds > 0
        ? raw.gracePeriodSeconds
        : base.gracePeriodSeconds,
    screenshotEnabled: raw.screenshotEnabled ?? base.screenshotEnabled,
    screenshotIntervalMinutes:
      raw.screenshotIntervalMinutes ?? base.screenshotIntervalMinutes,
    screenshotRetentionDays:
      raw.screenshotRetentionDays ?? base.screenshotRetentionDays,
    allowLowInputWork: raw.allowLowInputWork ?? base.allowLowInputWork,
    monitoringNotice: raw.monitoringNotice?.trim()
      ? raw.monitoringNotice
      : base.monitoringNotice,
  };
}
