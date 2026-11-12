"use client";

import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import type { ReviewStatus } from "@/lib/types";

function ReviewQueue() {
  const { state, reviewSubmission, pendingSubmissions } = useStore();
  const pending = pendingSubmissions();
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  function act(
    id: string,
    status: Exclude<ReviewStatus, "pending">,
  ) {
    const note = feedback[id]?.trim() ?? "";
    if ((status === "rejected" || status === "revision_requested") && !note) {
      setFeedback((f) => ({ ...f, [id]: "Please provide clearer acceptance evidence." }));
      return;
    }
    reviewSubmission(id, status, note || "Looks good — accepted.");
  }

  return (
    <AppShell title="Submission review queue">
      <p className="mb-4 text-muted-foreground">
        Approve task output, request revisions, or reject with feedback. Activity signals alone are
        not acceptance criteria.
      </p>
      <div className="space-y-3">
        {pending.map((sub) => {
          const task = state.tasks.find((t) => t.id === sub.taskId);
          const emp = state.employees.find((e) => e.id === sub.employeeId);
          return (
            <article
              key={sub.id}
              className="animate-slide-up rounded-xl border border-border/80 bg-white/90 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-heading text-xl font-semibold">
                    {task?.title ?? "Task"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {emp?.name} · submitted {formatDateTime(sub.submittedAt)}
                  </p>
                </div>
                <Badge>Pending</Badge>
              </div>
              <p className="mt-3 text-sm">{sub.notes}</p>
              {sub.links.length > 0 && (
                <ul className="mt-2 text-sm">
                  {sub.links.map((l) => (
                    <li key={l}>
                      <a className="text-primary underline" href={l} target="_blank" rel="noreferrer">
                        {l}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 space-y-2">
                <Label>Feedback</Label>
                <Textarea
                  value={feedback[sub.id] ?? ""}
                  onChange={(e) =>
                    setFeedback((f) => ({ ...f, [sub.id]: e.target.value }))
                  }
                  placeholder="Required for reject / revision"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button onClick={() => act(sub.id, "approved")}>Approve</Button>
                <Button variant="secondary" onClick={() => act(sub.id, "revision_requested")}>
                  Request revision
                </Button>
                <Button variant="outline" onClick={() => act(sub.id, "rejected")}>
                  Reject
                </Button>
              </div>
            </article>
          );
        })}
        {pending.length === 0 && (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            No pending submissions. Great — queue is clear.
          </p>
        )}
      </div>

      <section className="mt-6 rounded-xl border border-border/80 bg-white/90 p-5">
        <h2 className="font-heading text-lg font-semibold">Recent reviews</h2>
        <div className="mt-3 space-y-2 text-sm">
          {state.submissions
            .filter((s) => s.reviewStatus !== "pending")
            .slice(0, 5)
            .map((s) => {
              const task = state.tasks.find((t) => t.id === s.taskId);
              return (
                <div
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 py-2"
                >
                  <span>{task?.title}</span>
                  <Badge variant="secondary">{s.reviewStatus.replaceAll("_", " ")}</Badge>
                </div>
              );
            })}
        </div>
      </section>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["manager"]}>
      <ReviewQueue />
    </AuthGate>
  );
}
