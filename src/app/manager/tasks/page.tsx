"use client";

import { useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { AppShell } from "@/components/app-shell";
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
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";
import { formatDateTime } from "@/lib/time";
import type { TaskPriority } from "@/lib/types";

function AssignTasks() {
  const { currentUser, state, createTask, teamEmployees } = useStore();
  const employees = teamEmployees();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [criteria, setCriteria] = useState("");
  const [weeklyTarget, setWeeklyTarget] = useState("");
  const [assigneeId, setAssigneeId] = useState(employees[0]?.id ?? "");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueInDays, setDueInDays] = useState("5");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser || !title.trim() || !assigneeId) return;
    const start = new Date();
    const due = new Date();
    due.setDate(due.getDate() + Number(dueInDays || 5));
    createTask({
      title: title.trim(),
      description: description.trim(),
      expectedOutput: expectedOutput.trim(),
      acceptanceCriteria: criteria
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
      assigneeId,
      ownerId: currentUser.id,
      priority,
      startDate: start.toISOString(),
      dueDate: due.toISOString(),
      weeklyTarget: weeklyTarget.trim(),
    });
    setTitle("");
    setDescription("");
    setExpectedOutput("");
    setCriteria("");
    setWeeklyTarget("");
  }

  return (
    <AppShell title="Assign weekly tasks">
      <div className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={onSubmit}
          className="animate-slide-up space-y-3 rounded-xl border border-border/80 bg-white/90 p-5"
        >
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Expected output</Label>
            <Input value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Acceptance criteria (one per line)</Label>
            <Textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Weekly target</Label>
            <Input value={weeklyTarget} onChange={(e) => setWeeklyTarget(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name}
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
            <div className="space-y-2">
              <Label>Due in days</Label>
              <Input
                type="number"
                min={1}
                value={dueInDays}
                onChange={(e) => setDueInDays(e.target.value)}
              />
            </div>
          </div>
          <Button type="submit">Create task</Button>
        </form>

        <section className="animate-slide-up stagger-2 space-y-3">
          {state.tasks.map((task) => {
            const emp = state.employees.find((e) => e.id === task.assigneeId);
            return (
              <article
                key={task.id}
                className="rounded-xl border border-border/80 bg-white/90 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-heading font-semibold">{task.title}</h2>
                  <Badge variant="secondary">{task.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {emp?.name} · due {formatDateTime(task.dueDate)} · {task.priority}
                </p>
              </article>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}

export default function Page() {
  return (
    <AuthGate roles={["manager"]}>
      <AssignTasks />
    </AuthGate>
  );
}
