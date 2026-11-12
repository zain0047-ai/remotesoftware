"use client";

import { useMemo, useRef, useState } from "react";
import { FilePlus2, Paperclip, Plus, UserRound } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import type { Task, TaskAttachment, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const COLUMNS: { id: TaskStatus; title: string; hint: string }[] = [
  { id: "assigned", title: "To do", hint: "Newly allocated" },
  { id: "in_progress", title: "In progress", hint: "Being worked" },
  { id: "submitted", title: "Submitted", hint: "Awaiting review" },
  { id: "approved", title: "Done", hint: "Approved" },
  { id: "overdue", title: "Overdue", hint: "Past due" },
];

const PRIORITY_TONE: Record<TaskPriority, string> = {
  low: "bg-slate-100 text-slate-700",
  medium: "bg-sky-100 text-sky-800",
  high: "bg-amber-100 text-amber-900",
  critical: "bg-rose-100 text-rose-900",
};

function WorkAllocationBoard() {
  const {
    currentUser,
    state,
    createTask,
    updateTaskStatus,
    updateTaskAssignee,
  } = useStore();

  const members = useMemo(
    () =>
      state.employees
        .filter((e) => e.status === "active")
        .sort((a, b) => a.name.localeCompare(b.name)),
    [state.employees],
  );

  const [composerOpen, setComposerOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("assigned");
  const [assigneeId, setAssigneeId] = useState(members[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [criteria, setCriteria] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueInDays, setDueInDays] = useState("5");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropColumn, setDropColumn] = useState<TaskStatus | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tasksByColumn = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      assigned: [],
      in_progress: [],
      submitted: [],
      approved: [],
      overdue: [],
    };
    for (const task of state.tasks) {
      map[task.status]?.push(task);
    }
    return map;
  }, [state.tasks]);

  function openComposer(status: TaskStatus = "assigned", memberId?: string) {
    setDefaultStatus(status);
    setAssigneeId(memberId || members[0]?.id || "");
    setTitle("");
    setDescription("");
    setExpectedOutput("Completed deliverable as described");
    setCriteria("Task completed as assigned");
    setWeeklyTarget("Complete by due date");
    setPriority("medium");
    setDueInDays("5");
    setFiles([]);
    setError("");
    setComposerOpen(true);
  }

  function closeComposer() {
    if (busy) return;
    setComposerOpen(false);
    setFiles([]);
    setError("");
  }

  async function uploadAll(selected: File[]): Promise<TaskAttachment[]> {
    const uploaded: TaskAttachment[] = [];
    for (const file of selected) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body });
      const data = (await res.json()) as TaskAttachment & { error?: string };
      if (!res.ok) throw new Error(data.error || `Failed to upload ${file.name}`);
      uploaded.push({
        id: data.id,
        name: data.name,
        mimeType: data.mimeType,
        size: data.size,
        url: data.url,
        uploadedAt: data.uploadedAt,
      });
    }
    return uploaded;
  }

  function onDragStart(taskId: string) {
    setDraggingId(taskId);
  }

  function onDragEnd() {
    setDraggingId(null);
    setDropColumn(null);
  }

  function onDropColumn(status: TaskStatus) {
    if (!draggingId) return;
    updateTaskStatus(draggingId, status);
    setDraggingId(null);
    setDropColumn(null);
  }

  return (
    <AppShell title="Work allocation">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-muted-foreground">
          Trello-style board: drag cards across columns, assign members, and attach files when you
          add a card.
        </p>
        <Button onClick={() => openComposer("assigned")}>
          <Plus className="size-4" />
          Add card
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const cards = tasksByColumn[col.id];
          const isOver = dropColumn === col.id;
          return (
            <section
              key={col.id}
              className={cn(
                "flex w-72 shrink-0 flex-col rounded-xl border bg-[#f4f6f5] p-2",
                isOver ? "border-primary ring-2 ring-primary/20" : "border-border/70",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDropColumn(col.id);
              }}
              onDragLeave={() => {
                if (dropColumn === col.id) setDropColumn(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                onDropColumn(col.id);
              }}
            >
              <header className="mb-2 flex items-center justify-between px-2 pt-1">
                <div>
                  <h2 className="text-sm font-semibold tracking-tight">{col.title}</h2>
                  <p className="text-[11px] text-muted-foreground">{col.hint}</p>
                </div>
                <Badge variant="secondary">{cards.length}</Badge>
              </header>

              <div className="flex min-h-[420px] flex-1 flex-col gap-2 overflow-y-auto px-1 pb-2">
                {cards.map((task) => {
                  const assignee = state.employees.find((e) => e.id === task.assigneeId);
                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => onDragStart(task.id)}
                      onDragEnd={onDragEnd}
                      className={cn(
                        "cursor-grab rounded-lg border border-border/60 bg-white p-3 shadow-sm active:cursor-grabbing",
                        draggingId === task.id && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{task.title}</p>
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                            PRIORITY_TONE[task.priority],
                          )}
                        >
                          {task.priority}
                        </span>
                      </div>
                      {task.description ? (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5">
                          <UserRound className="size-3" />
                          {assignee?.name ?? "Unassigned"}
                        </span>
                        <span>Due {formatDateTime(task.dueDate)}</span>
                        {task.attachments && task.attachments.length > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="size-3" />
                            {task.attachments.length}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2">
                        <Select
                          value={task.assigneeId}
                          onValueChange={(v) => {
                            if (v) updateTaskAssignee(task.id, v);
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Reassign" />
                          </SelectTrigger>
                          <SelectContent>
                            {members.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.name} ({m.role})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </article>
                  );
                })}
                {cards.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border/70 px-3 py-8 text-center text-xs text-muted-foreground">
                    Drop cards here
                  </p>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="mt-1 justify-start text-muted-foreground"
                onClick={() => openComposer(col.id)}
              >
                <Plus className="size-4" />
                Add a card
              </Button>
            </section>
          );
        })}
      </div>

      <Dialog open={composerOpen} onOpenChange={(open) => !open && closeComposer()}>
        <DialogContent className="sm:max-w-lg" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle className="font-heading">Add work card</DialogTitle>
            <DialogDescription>
              Same flow as allocating work — pick a member, write the task, attach files if needed.
            </DialogDescription>
          </DialogHeader>
          <ComposerForm
            members={members}
            assigneeId={assigneeId}
            setAssigneeId={setAssigneeId}
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            expectedOutput={expectedOutput}
            setExpectedOutput={setExpectedOutput}
            criteria={criteria}
            setCriteria={setCriteria}
            weeklyTarget={weeklyTarget}
            setWeeklyTarget={setWeeklyTarget}
            priority={priority}
            setPriority={setPriority}
            dueInDays={dueInDays}
            setDueInDays={setDueInDays}
            files={files}
            setFiles={setFiles}
            fileInputRef={fileInputRef}
            busy={busy}
            error={error}
            onCancel={closeComposer}
            onSubmit={async (e) => {
              e.preventDefault();
              if (!currentUser || !assigneeId) return;
              if (!title.trim()) {
                setError("Please enter a card title.");
                return;
              }
              setBusy(true);
              setError("");
              try {
                const attachments = files.length > 0 ? await uploadAll(files) : [];
                const start = new Date();
                const due = new Date();
                due.setDate(due.getDate() + Number(dueInDays || 5));
                createTask(
                  {
                    title: title.trim(),
                    description: description.trim() || title.trim(),
                    expectedOutput: expectedOutput.trim() || "Completed deliverable",
                    acceptanceCriteria: (criteria || "Task completed as assigned")
                      .split("\n")
                      .map((c) => c.trim())
                      .filter(Boolean),
                    assigneeId,
                    ownerId: currentUser.id,
                    priority,
                    startDate: start.toISOString(),
                    dueDate: due.toISOString(),
                    weeklyTarget: weeklyTarget.trim() || "Complete by due date",
                    attachments,
                  },
                  defaultStatus,
                );
                setComposerOpen(false);
                setFiles([]);
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not create card.");
              } finally {
                setBusy(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ComposerForm({
  members,
  assigneeId,
  setAssigneeId,
  title,
  setTitle,
  description,
  setDescription,
  expectedOutput,
  setExpectedOutput,
  criteria,
  setCriteria,
  weeklyTarget,
  setWeeklyTarget,
  priority,
  setPriority,
  dueInDays,
  setDueInDays,
  files,
  setFiles,
  fileInputRef,
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  members: { id: string; name: string; role: string }[];
  assigneeId: string;
  setAssigneeId: (v: string) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  expectedOutput: string;
  setExpectedOutput: (v: string) => void;
  criteria: string;
  setCriteria: (v: string) => void;
  weeklyTarget: string;
  setWeeklyTarget: (v: string) => void;
  priority: TaskPriority;
  setPriority: (v: TaskPriority) => void;
  dueInDays: string;
  setDueInDays: (v: string) => void;
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-2">
        <Label>Title</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Prepare weekly client update"
          required
        />
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What should they do?"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Assign to</Label>
          <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name} ({m.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority((v as TaskPriority) ?? "medium")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["low", "medium", "high", "critical"] as TaskPriority[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Due in days</Label>
          <Input
            type="number"
            min={1}
            value={dueInDays}
            onChange={(e) => setDueInDays(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Weekly target</Label>
          <Input value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Expected output</Label>
        <Input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Acceptance criteria (one per line)</Label>
        <Textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>Attachments</Label>
        <div
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-secondary/30 px-4 py-6 text-center transition-colors hover:bg-secondary/50"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = Array.from(e.dataTransfer.files);
            if (dropped.length) setFiles((prev) => [...prev, ...dropped]);
          }}
        >
          <FilePlus2 className="size-8 text-primary" />
          <p className="text-sm font-medium">Click to add files or drag &amp; drop</p>
          <p className="text-xs text-muted-foreground">Multiple files · max 12 MB each</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            if (chosen.length) setFiles((prev) => [...prev, ...chosen]);
            e.target.value = "";
          }}
        />
        {files.length > 0 && (
          <ul className="space-y-1 text-sm">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between gap-2 rounded-md border px-2 py-1"
              >
                <span className="truncate">
                  <Paperclip className="mr-1 inline size-3" />
                  {f.name}
                </span>
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="gap-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || members.length === 0}>
          {busy ? "Saving…" : "Add card"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["admin"]}>
      <WorkAllocationBoard />
    </AuthGate>
  );
}
