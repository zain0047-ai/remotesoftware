"use client";

import { useMemo, useState } from "react";
import { Bell, Link2, MessageSquare, Send } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

function EmployeeMeetingsPage() {
  const {
    currentUser,
    state,
    sendGroupChat,
    markNotificationRead,
    markAllNotificationsRead,
  } = useStore();

  const myId = currentUser?.id ?? "";

  const myMeetings = useMemo(
    () =>
      (state.meetings ?? []).filter((m) => m.participantIds.includes(myId)),
    [state.meetings, myId],
  );

  const myGroups = useMemo(
    () =>
      (state.meetingGroups ?? []).filter((g) => g.memberIds.includes(myId)),
    [state.meetingGroups, myId],
  );

  const myNotifications = useMemo(
    () =>
      (state.notifications ?? [])
        .filter((n) => n.userId === myId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.notifications, myId],
  );

  const unread = myNotifications.filter((n) => !n.readAt);

  const [tab, setTab] = useState<"inbox" | "meetings" | "chat">("inbox");
  const [chatGroupId, setChatGroupId] = useState(myGroups[0]?.id ?? "");
  const [chatBody, setChatBody] = useState("");
  const [error, setError] = useState("");

  const chatMessages = (state.chatMessages ?? []).filter(
    (m) => m.groupId === chatGroupId,
  );

  function onSendChat(e: React.FormEvent) {
    e.preventDefault();
    const result = sendGroupChat(chatGroupId, chatBody);
    if (!result.ok) {
      setError(result.error ?? "Could not send.");
      return;
    }
    setChatBody("");
    setError("");
  }

  return (
    <AppShell title="Meetings">
      <p className="mb-4 max-w-2xl text-muted-foreground">
        Meeting invites, join links from your admin, and group chat when you need
        to discuss an issue with the team.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={tab === "inbox" ? "default" : "outline"}
          onClick={() => setTab("inbox")}
        >
          <Bell className="size-4" />
          Inbox
          {unread.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {unread.length}
            </Badge>
          )}
        </Button>
        <Button
          size="sm"
          variant={tab === "meetings" ? "default" : "outline"}
          onClick={() => setTab("meetings")}
        >
          My meetings
        </Button>
        <Button
          size="sm"
          variant={tab === "chat" ? "default" : "outline"}
          onClick={() => setTab("chat")}
        >
          <MessageSquare className="size-4" />
          Group chat
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {error}
        </div>
      )}

      {tab === "inbox" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-heading text-lg font-semibold">Notifications</h2>
            {unread.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllNotificationsRead()}
              >
                Mark all read
              </Button>
            )}
          </div>
          {myNotifications.length === 0 && (
            <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
              No meeting notifications yet.
            </p>
          )}
          {myNotifications.map((n) => (
            <article
              key={n.id}
              className={cn(
                "rounded-xl border bg-white p-4",
                n.readAt ? "border-border/60 opacity-80" : "border-primary/40",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{n.title}</p>
                    {!n.readAt && <Badge>New</Badge>}
                    <Badge variant="secondary">{n.type.replace("_", " ")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(n.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {n.link && (
                    <Button
                      size="sm"
                      onClick={() =>
                        window.open(n.link, "_blank", "noopener,noreferrer")
                      }
                    >
                      <Link2 className="size-4" />
                      Join meeting
                    </Button>
                  )}
                  {!n.readAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markNotificationRead(n.id)}
                    >
                      Mark read
                    </Button>
                  )}
                  {n.groupId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setChatGroupId(n.groupId!);
                        setTab("chat");
                        markNotificationRead(n.id);
                      }}
                    >
                      Open chat
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === "meetings" && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-semibold">Assigned to you</h2>
          {myMeetings.length === 0 && (
            <p className="rounded-lg border border-dashed px-3 py-10 text-center text-sm text-muted-foreground">
              You are not in any meetings yet.
            </p>
          )}
          {myMeetings.map((m) => {
            const group = (state.meetingGroups ?? []).find(
              (g) => g.id === m.groupId,
            );
            return (
              <article
                key={m.id}
                className="rounded-xl border border-border/70 bg-white p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{m.title}</p>
                  <Badge variant="secondary">
                    {m.kind === "group" ? "Group" : "1:1"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {group ? `${group.name} · ` : ""}
                  {m.scheduledAt
                    ? `Starts ${formatDateTime(m.scheduledAt)}`
                    : "Time not set yet"}
                  {m.notes ? ` · ${m.notes}` : ""}
                </p>
                {m.meetingLink ? (
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      window.open(m.meetingLink, "_blank", "noopener,noreferrer")
                    }
                  >
                    <Link2 className="size-4" />
                    Open meeting link
                  </Button>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Waiting for admin to paste and send the link.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}

      {tab === "chat" && (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <div className="space-y-2 rounded-xl border border-border/70 bg-white p-3">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your groups
            </p>
            {myGroups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setChatGroupId(g.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm",
                  chatGroupId === g.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-secondary",
                )}
              >
                <MessageSquare className="size-4 shrink-0" />
                <span className="truncate">{g.name}</span>
              </button>
            ))}
            {myGroups.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                You are not in a meeting group yet.
              </p>
            )}
          </div>

          <div className="flex min-h-[420px] flex-col rounded-xl border border-border/70 bg-white">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="font-medium">
                {myGroups.find((g) => g.id === chatGroupId)?.name ??
                  "Select a group"}
              </p>
              <p className="text-xs text-muted-foreground">
                Ask questions or flag issues for the group and admin.
              </p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {chatMessages.map((msg) => {
                const author =
                  state.employees.find((e) => e.id === msg.authorId)?.name ??
                  "Unknown";
                const mine = msg.authorId === myId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      mine
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-secondary",
                    )}
                  >
                    {!mine && (
                      <p className="mb-0.5 text-[11px] font-medium opacity-80">
                        {author}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.body}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        mine
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground",
                      )}
                    >
                      {formatDateTime(msg.createdAt)}
                    </p>
                  </div>
                );
              })}
              {chatGroupId && chatMessages.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet — start the discussion.
                </p>
              )}
            </div>
            <form
              onSubmit={onSendChat}
              className="flex gap-2 border-t border-border/60 p-3"
            >
              <Input
                value={chatBody}
                onChange={(e) => setChatBody(e.target.value)}
                placeholder="Describe your issue or question…"
                disabled={!chatGroupId}
              />
              <Button type="submit" disabled={!chatGroupId || !chatBody.trim()}>
                <Send className="size-4" />
                Send
              </Button>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["employee"]}>
      <EmployeeMeetingsPage />
    </AuthGate>
  );
}
