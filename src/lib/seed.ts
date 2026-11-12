import { defaultPolicy } from "./policy";
import type { AppState } from "./types";

/** Empty starter state — no demo users. First admin is created via bootstrap. */
export function createSeedState(): AppState {
  return {
    currentUserId: null,
    policy: defaultPolicy(),
    employees: [],
    sessions: [],
    timeEvents: [],
    tasks: [],
    submissions: [],
    screenshots: [],
    reports: [],
    backups: [],
    auditLogs: [],
    meetingGroups: [],
    meetings: [],
    notifications: [],
    chatMessages: [],
  };
}
