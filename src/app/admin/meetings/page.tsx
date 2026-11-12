"use client";

import { useMemo, useState } from "react";
import { Link2, MessageSquare, Plus, Send, Users } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { isoToLocalInput, localInputToIso } from "@/lib/meeting-reminders";
import { formatDateTime } from "@/lib/time";
import type { MeetingKind } from "@/lib/types";
import { cn } from "@/lib/utils";

function AdminMeetingsPage() {
  const {
    currentUser,
    state,
    createMeetingGroup,
    updateMeetingGroupMembers,
    createMeeting,
    updateMeetingLink,
    sendMeetingLink,
    sendGroupChat,
  } = useStore();

  const activePeople = useMemo(
    () =>
      state.employees
        .filter((e) => e.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.employees],
  );

  const selectableMembers = useMemo(
    () => activePeople.filter((e) => e.role === "employee" || e.role === "manager"),
    [activePeople],
  );

  const groups = state.meetingGroups ?? [];
  const meetings = state.meetings ?? [];

  const [tab, setTab] = useState<"meetings" | "groups" | "chat">("meetings");
  const [kind, setKind] = useState<MeetingKind>("single");
  const [title, setTitle] = useState("");
  const [singleId, setSingleId] = useState(selectableMembers[0]?.id ?? "");
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [link, setLink] = useState("");
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [notes, setNotes] = useState("");
  const [sendNow, setSendNow] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(
    null,
  );
  const [pasteLink, setPasteLink] = useState("");
  const [pasteScheduledLocal, setPasteScheduledLocal] = useState("");
  const [chatGroupId, setChatGroupId] = useState(groups[0]?.id ?? "");
  const [chatBody, setChatBody] = useState("");

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? null;
  const chatMessages = (state.chatMessages ?? []).filter(
    (m) => m.groupId === chatGroupId,
  );

  function toggleMember(id: string) {
    setGroupMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function onCreateMeeting(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!title.trim()) {
      setError("Enter a meeting title.");
      return;
    }
    if (kind === "single" && !singleId) {
      setError("Pick an employee for the single meeting.");
      return;
    }
    if (kind === "group" && !groupId) {
      setError("Create or pick a group first.");
      return;
    }
    if (sendNow && !link.trim()) {
      setError("Paste a meeting link before sending notifications.");
      return;
    }
    const scheduledAt = localInputToIso(scheduledLocal);
    if ((sendNow || scheduledLocal) && !scheduledAt) {
      setError("Pick a valid meeting date and time.");
      return;
    }
    if (sendNow && !scheduledAt) {
      setError("Set meeting time so everyone gets the schedule and a 15‑minute reminder.");
      return;
    }
    const id = createMeeting({
      kind,
      title: title.trim(),
      participantIds: kind === "single" ? [singleId] : [],
      groupId: kind === "group" ? groupId : undefined,
      meetingLink: link.trim() || undefined,
      scheduledAt,
      notes: notes.trim() || undefined,
      sendNow: sendNow && Boolean(link.trim()),
    });
    if (!id) {
      setError(
        sendNow && link.trim() && !scheduledAt
          ? "Meeting time is required when sending the link."
          : "Could not create meeting.",
      );
      return;
    }
    setInfo(
      sendNow && link.trim()
        ? "Meeting created — participants notified with the time. Reminder goes out 15 minutes before."
        : "Meeting created. Open it below to paste a link, set time, and notify members.",
    );
    setTitle("");
    setLink("");
    setScheduledLocal("");
    setNotes("");
    setSelectedMeetingId(id);
  }

  function onCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!groupName.trim()) {
      setError("Enter a group name.");
      return;
    }
    if (groupMembers.length === 0) {
      setError("Select at least one member. New approved accounts appear here.");
      return;
    }
    const id = createMeetingGroup({
      name: groupName.trim(),
      memberIds: groupMembers,
    });
    if (!id) {
      setError("Could not create group.");
      return;
    }
    setInfo("Group created. New approved employees are auto-added to existing groups.");
    setGroupName("");
    setGroupMembers([]);
    setGroupId(id);
    setChatGroupId(id);
    setTab("meetings");
  }

  function onSendSelectedLink() {
    if (!selectedMeeting) return;
    setError("");
    setInfo("");
    if (pasteLink.trim()) {
      updateMeetingLink(selectedMeeting.id, pasteLink.trim());
    }
    const scheduledAt =
      localInputToIso(pasteScheduledLocal) || selectedMeeting.scheduledAt;
    if (!scheduledAt) {
      setError("Set the meeting date and time before sending.");
      return;
    }
    const result = sendMeetingLink(selectedMeeting.id, { scheduledAt });
    if (!result.ok) {
      setError(result.error ?? "Could not send link.");
      return;
    }
    setInfo(
      selectedMeeting.kind === "group"
        ? "Link + time sent to the group. Everyone gets a reminder 15 minutes before."
        : "Link + time sent to the employee. Reminder goes out 15 minutes before.",
    );
    setPasteLink("");
  }

  function onSendChat(e: React.FormEvent) {
    e.preventDefault();
    const result = sendGroupChat(chatGroupId, chatBody);
    if (!result.ok) {
      setError(result.error ?? "Could not send message.");
      return;
    }
    setChatBody("");
    setError("");
  }

  return (
    <AppShell title="Meetings">
      <p className="mb-4 max-w-3xl text-muted-foreground">
        Schedule a single-employee or group meeting, paste the call link, notify
        everyone, and use group chat when someone needs to discuss an issue.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["meetings", "Meetings"],
            ["groups", "Groups"],
            ["chat", "Group chat"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            variant={tab === id ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {(error || info) && (
        <div
          className={cn(
            "mb-4 rounded-lg border px-3 py-2 text-sm",
            error
              ? "border-rose-200 bg-rose-50 text-rose-900"
              : "border-emerald-200 bg-emerald-50 text-emerald-900",
          )}
        >
          {error || info}
        </div>
      )}

      {tab === "meetings" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <form
            onSubmit={onCreateMeeting}
            className="space-y-4 rounded-xl border border-border/70 bg-white p-4"
          >
            <h2 className="font-heading text-lg font-semibold">New meeting</h2>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={kind === "single" ? "default" : "outline"}
                onClick={() => setKind("single")}
              >
                Single employee
              </Button>
              <Button
                type="button"
                size="sm"
                variant={kind === "group" ? "default" : "outline"}
                onClick={() => setKind("group")}
              >
                Group meeting
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meet-title">Title</Label>
              <Input
                id="meet-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Weekly sync"
              />
            </div>

            {kind === "single" ? (
              <div className="space-y-2">
                <Label>Employee</Label>
                <Select
                  value={singleId}
                  onValueChange={(v) => v && setSingleId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableMembers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.team}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectableMembers.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Approve an employee account first — new accounts show up here
                    for single meetings.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Group</Label>
                <Select value={groupId} onValueChange={(v) => v && setGroupId(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select group" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({g.memberIds.length})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {groups.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Create a group under the Groups tab first.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="meet-link">Meeting link (paste)</Label>
              <Input
                id="meet-link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://meet.google.com/… or Zoom / Teams"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meet-time">Meeting date &amp; time</Label>
              <Input
                id="meet-time"
                type="datetime-local"
                value={scheduledLocal}
                onChange={(e) => setScheduledLocal(e.target.value)}
                required={sendNow}
              />
              <p className="text-[11px] text-muted-foreground">
                Shown in notifications. A reminder is sent automatically 15 minutes
                before this time.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="meet-notes">Notes (optional)</Label>
              <Textarea
                id="meet-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendNow}
                onChange={(e) => setSendNow(e.target.checked)}
              />
              Send link + time notification now to all participants
            </label>

            <Button type="submit">
              <Plus className="size-4" />
              Create meeting
            </Button>
          </form>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Scheduled</h2>
            {meetings.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                No meetings yet.
              </p>
            )}
            {meetings.map((m) => {
              const group = groups.find((g) => g.id === m.groupId);
              const people = m.participantIds
                .map((id) => state.employees.find((e) => e.id === id)?.name)
                .filter(Boolean)
                .join(", ");
              const active = selectedMeetingId === m.id;
              return (
                <article
                  key={m.id}
                  className={cn(
                    "rounded-xl border bg-white p-4",
                    active ? "border-primary ring-2 ring-primary/15" : "border-border/70",
                  )}
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedMeetingId(m.id);
                      setPasteLink(m.meetingLink ?? "");
                      setPasteScheduledLocal(isoToLocalInput(m.scheduledAt));
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{m.title}</p>
                      <Badge variant="secondary">
                        {m.kind === "group" ? "Group" : "Single"}
                      </Badge>
                      {m.linkSentAt ? (
                        <Badge>Link sent</Badge>
                      ) : (
                        <Badge variant="outline">Link pending</Badge>
                      )}
                      {m.reminderSentAt && (
                        <Badge variant="outline">Reminder sent</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {group ? `${group.name} · ` : ""}
                      {people || "No participants"}
                      {m.scheduledAt
                        ? ` · Starts ${formatDateTime(m.scheduledAt)}`
                        : " · Time not set"}
                    </p>
                  </button>

                  {active && (
                    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                      <Label htmlFor={`paste-${m.id}`}>Paste meeting link</Label>
                      <Input
                        id={`paste-${m.id}`}
                        value={pasteLink}
                        onChange={(e) => setPasteLink(e.target.value)}
                        placeholder="Paste Zoom / Meet / Teams link"
                      />
                      <Label htmlFor={`time-${m.id}`}>Meeting date &amp; time</Label>
                      <Input
                        id={`time-${m.id}`}
                        type="datetime-local"
                        value={pasteScheduledLocal}
                        onChange={(e) => setPasteScheduledLocal(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Notifications include this time. Reminder auto-sends 15
                        minutes before start.
                      </p>
                      <Button type="button" onClick={onSendSelectedLink}>
                        <Send className="size-4" />
                        Send link + time to{" "}
                        {m.kind === "group" ? "group" : "employee"}
                      </Button>
                      {m.meetingLink && (
                        <a
                          href={m.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline"
                        >
                          <Link2 className="size-3.5" />
                          Open current link
                        </a>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      )}

      {tab === "groups" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={onCreateGroup}
            className="space-y-4 rounded-xl border border-border/70 bg-white p-4"
          >
            <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
              <Users className="size-5" />
              New group
            </h2>
            <div className="space-y-2">
              <Label htmlFor="group-name">Group name</Label>
              <Input
                id="group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Product squad"
              />
            </div>
            <div className="space-y-2">
              <Label>Members</Label>
              <p className="text-xs text-muted-foreground">
                New approved accounts appear in this list and are also auto-added
                to existing groups.
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border/60 p-2">
                {selectableMembers.map((m) => (
                  <label
                    key={m.id}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={groupMembers.includes(m.id)}
                      onChange={() => toggleMember(m.id)}
                    />
                    <span>
                      {m.name}{" "}
                      <span className="text-muted-foreground">· {m.team}</span>
                    </span>
                  </label>
                ))}
                {selectableMembers.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                    No active employees yet.
                  </p>
                )}
              </div>
            </div>
            <Button type="submit">Create group</Button>
          </form>

          <div className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Your groups</h2>
            {groups.map((g) => (
              <article
                key={g.id}
                className="rounded-xl border border-border/70 bg-white p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {g.memberIds.length} members · created{" "}
                      {formatDateTime(g.createdAt)}
                    </p>
                  </div>
                  <Badge variant="secondary">{g.memberIds.length}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {selectableMembers.map((m) => {
                    const on = g.memberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground",
                        )}
                        onClick={() => {
                          const next = on
                            ? g.memberIds.filter((id) => id !== m.id)
                            : [...g.memberIds, m.id];
                          updateMeetingGroupMembers(g.id, next);
                        }}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
            {groups.length === 0 && (
              <p className="rounded-lg border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
                No groups yet.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "chat" && (
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="space-y-2 rounded-xl border border-border/70 bg-white p-3">
            <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Groups
            </p>
            {groups.map((g) => (
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
            {groups.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                Create a group to open chat.
              </p>
            )}
          </div>

          <div className="flex min-h-[420px] flex-col rounded-xl border border-border/70 bg-white">
            <div className="border-b border-border/60 px-4 py-3">
              <p className="font-medium">
                {groups.find((g) => g.id === chatGroupId)?.name ?? "Select a group"}
              </p>
              <p className="text-xs text-muted-foreground">
                Employees can discuss blockers here; you can reply as admin.
              </p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {chatMessages.map((msg) => {
                const author =
                  state.employees.find((e) => e.id === msg.authorId)?.name ??
                  "Unknown";
                const mine = msg.authorId === currentUser?.id;
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
                        mine ? "text-primary-foreground/70" : "text-muted-foreground",
                      )}
                    >
                      {formatDateTime(msg.createdAt)}
                    </p>
                  </div>
                );
              })}
              {chatGroupId && chatMessages.length === 0 && (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No messages yet. Start the discussion.
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
                placeholder="Write a message…"
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
    <AuthGate roles={["admin"]}>
      <AdminMeetingsPage />
    </AuthGate>
  );
}
