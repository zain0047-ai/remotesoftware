export type Role = "employee" | "manager" | "admin";

export type SessionStatus = "active" | "on_break" | "idle_warning" | "ended" | "interrupted";

export type TimeEventType =
  | "work"
  | "break"
  | "idle_signal"
  | "low_input"
  | "grace";

export type ReviewStatus = "pending" | "approved" | "rejected" | "revision_requested";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export type TaskStatus = "assigned" | "in_progress" | "submitted" | "approved" | "overdue";

export type EmployeeStatus = "pending" | "active" | "inactive" | "rejected";

export type PresenceStatus = "online" | "offline";

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: Role;
  team: string;
  /** Account approval lifecycle — not the same as signed-in presence */
  status: EmployeeStatus;
  password: string;
  /** Currently signed into the app (updates on login/logout) */
  presence: PresenceStatus;
  lastSeenAt?: string;
  registeredAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface Session {
  id: string;
  employeeId: string;
  startTime: string;
  endTime?: string;
  endReason?: string;
  status: SessionStatus;
  monitoringAcknowledged: boolean;
  noticeShownAt?: string;
}

export interface TimeEvent {
  id: string;
  sessionId: string;
  employeeId: string;
  type: TimeEventType;
  startTime: string;
  endTime?: string;
  source: "system" | "employee" | "manager";
  reviewStatus: "open" | "confirmed" | "disputed" | "resolved";
  note?: string;
}

export interface TaskAttachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  /** Public path served by /api/uploads/[id] */
  url: string;
  uploadedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  expectedOutput: string;
  acceptanceCriteria: string[];
  assigneeId: string;
  ownerId: string;
  priority: TaskPriority;
  status: TaskStatus;
  startDate: string;
  dueDate: string;
  weeklyTarget: string;
  attachments?: TaskAttachment[];
}

export interface Submission {
  id: string;
  taskId: string;
  employeeId: string;
  submittedAt: string;
  notes: string;
  links: string[];
  reviewStatus: ReviewStatus;
  managerFeedback?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface ScreenshotRecord {
  id: string;
  sessionId: string;
  employeeId: string;
  timestamp: string;
  label: string;
  retentionUntil: string;
  /** MVP: simulated evidence only — no OS screen capture */
  simulated: true;
  accessLog: { actorId: string; at: string; action: string }[];
}

export type ReportKind = "daily" | "weekly" | "monthly" | "yearly" | "custom";

export type ReportPeriod = "day" | "week" | "month" | "year" | "custom";

export interface Report {
  id: string;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  kind: ReportKind;
  generatedAt: string;
  deliveryStatus: "draft" | "ready" | "failed" | "delivered";
  summary: {
    sessionMinutes: number;
    workMinutes: number;
    breakMinutes: number;
    idleMinutes: number;
    tasksAssigned: number;
    tasksSubmitted: number;
    tasksApproved: number;
  };
}

export interface BackupJob {
  id: string;
  scope: string;
  startedAt: string;
  completedAt?: string;
  verificationStatus: "pending" | "verified" | "failed";
  failureReason?: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  outcome: "success" | "denied" | "failure";
}

export interface MonitoringPolicy {
  /** Seconds without pointer/keyboard activity before the inactivity warning */
  idleThresholdSeconds: number;
  /** Countdown seconds shown before auto logout */
  gracePeriodSeconds: number;
  screenshotEnabled: boolean;
  screenshotIntervalMinutes: number;
  screenshotRetentionDays: number;
  /** Admin-only copy — not shown to employees */
  monitoringNotice: string;
  allowLowInputWork: boolean;
}

export type MeetingKind = "single" | "group";

/** Named roster of employees for group meetings + chat */
export interface MeetingGroup {
  id: string;
  name: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface Meeting {
  id: string;
  kind: MeetingKind;
  title: string;
  /** Set when kind === "group" */
  groupId?: string;
  /** Single: one employee. Group: members notified when link is sent. */
  participantIds: string[];
  meetingLink?: string;
  /** ISO start time — used for invite copy and 15‑minute reminders */
  scheduledAt?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  linkSentAt?: string;
  /** Set when the 15‑minute reminder notifications were created */
  reminderSentAt?: string;
}

export type NotificationType =
  | "meeting_invite"
  | "meeting_link"
  | "meeting_reminder"
  | "chat_message"
  | "general";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  meetingId?: string;
  groupId?: string;
  link?: string;
  createdAt: string;
  readAt?: string;
}

export interface ChatMessage {
  id: string;
  groupId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface AppState {
  employees: Employee[];
  sessions: Session[];
  timeEvents: TimeEvent[];
  tasks: Task[];
  submissions: Submission[];
  screenshots: ScreenshotRecord[];
  reports: Report[];
  backups: BackupJob[];
  auditLogs: AuditLog[];
  meetingGroups: MeetingGroup[];
  meetings: Meeting[];
  notifications: AppNotification[];
  chatMessages: ChatMessage[];
  policy: MonitoringPolicy;
  currentUserId: string | null;
}
