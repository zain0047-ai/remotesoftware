"use client";

import { useState } from "react";
import { Paperclip } from "lucide-react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";

function TasksPage() {
  const { currentUser, state, submitProgress } = useStore();
  const tasks = state.tasks.filter((t) => t.assigneeId === currentUser?.id);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [link, setLink] = useState("");

  const openTask = tasks.find((t) => t.id === openTaskId);

  return (
    <AppShell title="Assigned tasks">
      <p className="mb-4 text-muted-foreground">
        Weekly targets with measurable acceptance criteria. Submit daily progress for manager review.
      </p>
      <div className="space-y-3">
        {tasks.map((task) => {
          const subs = state.submissions.filter(
            (s) => s.taskId === task.id && s.employeeId === currentUser?.id,
          );
          return (
            <article
              key={task.id}
              className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold">{task.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{task.priority}</Badge>
                  <Badge>{task.status.replaceAll("_", " ")}</Badge>
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Expected output</dt>
                  <dd>{task.expectedOutput}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Weekly target</dt>
                  <dd>{task.weeklyTarget}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Due</dt>
                  <dd>{formatDateTime(task.dueDate)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Acceptance criteria</dt>
                  <dd>
                    <ul className="list-disc pl-5">
                      {task.acceptanceCriteria.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              {task.attachments && task.attachments.length > 0 && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">Attached files</p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {task.attachments.map((a) => (
                      <li key={a.id}>
                        <a
                          href={a.url}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:underline"
                        >
                          <Paperclip className="size-3" />
                          {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {subs[0] && (
                <div className="mt-3 rounded-md bg-secondary/50 px-3 py-2 text-sm">
                  Latest submission: {subs[0].reviewStatus.replaceAll("_", " ")}
                  {subs[0].managerFeedback && (
                    <p className="mt-1 text-muted-foreground">
                      Feedback: {subs[0].managerFeedback}
                    </p>
                  )}
                </div>
              )}
              <Button className="mt-4" onClick={() => setOpenTaskId(task.id)}>
                Submit daily progress
              </Button>
            </article>
          );
        })}
        {tasks.length === 0 && (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            No tasks assigned yet.
          </p>
        )}
      </div>

      <Dialog open={!!openTask} onOpenChange={(o) => !o && setOpenTaskId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">
              Submit progress — {openTask?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="notes">Progress notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What you completed, blockers, evidence of output"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="link">Link (optional)</Label>
              <Input
                id="link"
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!notes.trim() || !openTask}
              onClick={() => {
                if (!openTask) return;
                submitProgress({
                  taskId: openTask.id,
                  notes: notes.trim(),
                  links: link.trim() ? [link.trim()] : [],
                });
                setNotes("");
                setLink("");
                setOpenTaskId(null);
              }}
            >
              Submit for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["employee"]}>
      <TasksPage />
    </AuthGate>
  );
}
