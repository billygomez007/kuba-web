"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import EmptyState from "../../components/EmptyState";

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignedUserId: string | null;
  assignedEmployeeId: string | null;
  leadId: string | null;
  customerId: string | null;
  automationId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const priorityLabels: Record<string, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [priority, setPriority] =
    useState("normal");

  const [dueAt, setDueAt] =
    useState("");

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const response =
        await fetch("/api/tasks");

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to load tasks.",
        );
      }

      setTasks(data.tasks || []);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to load tasks.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInitialTasks() {
      try {
        const response =
          await fetch("/api/tasks");

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            data.error ||
              "Unable to load tasks.",
          );
        }

        if (!cancelled) {
          setTasks(data.tasks || []);
        }
      } catch (error) {
        if (!cancelled) {
          setError(
            error instanceof Error
              ? error.message
              : "Unable to load tasks.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadInitialTasks();

    return () => {
      cancelled = true;
    };
  }, []);

  async function createTask(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      const response =
        await fetch("/api/tasks", {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            title: title.trim(),
            description:
              description.trim() ||
              null,
            priority,
            dueAt:
              dueAt ||
              null,
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create task.",
        );
      }

      setTasks((current) => [
        data.task,
        ...current,
      ]);

      setTitle("");
      setDescription("");
      setPriority("normal");
      setDueAt("");
      setShowCreate(false);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create task.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(
    taskId: string,
    changes: Partial<Task>,
  ) {
    try {
      setError("");

      const response =
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: taskId,
            ...changes,
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to update task.",
        );
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? data.task
            : task,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update task.",
      );
    }
  }

  async function deleteTask(
    taskId: string,
  ) {
    const confirmed =
      window.confirm(
        "Delete this task?",
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");

      const response =
        await fetch("/api/tasks", {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: taskId,
          }),
        });

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to delete task.",
        );
      }

      setTasks((current) =>
        current.filter(
          (task) =>
            task.id !== taskId,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to delete task.",
      );
    }
  }

  const stats = useMemo(() => {
    return {
      total: tasks.length,

      pending: tasks.filter(
        (task) =>
          task.status === "pending",
      ).length,

      inProgress: tasks.filter(
        (task) =>
          task.status ===
          "in_progress",
      ).length,

      completed: tasks.filter(
        (task) =>
          task.status === "completed",
      ).length,

      urgent: tasks.filter(
        (task) =>
          task.priority === "urgent" &&
          task.status !== "completed",
      ).length,
    };
  }, [tasks]);

  return (
    <main className="min-h-screen bg-[#050507] px-6 py-10 text-white lg:ml-[250px]">
      <div className="mx-auto max-w-7xl">

        {/* Header */}
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/60">
              Operations
            </p>

            <h1 className="mt-2 text-3xl font-black">
              Tasks
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/35">
              One workspace for the work Kuba
              creates, assigns, and tracks.
            </p>
          </div>

          <div className="flex gap-3">

            <button
              type="button"
              onClick={loadTasks}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold transition hover:bg-white/[0.08]"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={() =>
                setShowCreate(
                  (current) =>
                    !current,
                )
              }
              className="rounded-xl bg-cyan-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-cyan-300"
            >
              {showCreate
                ? "Close"
                : "+ Create Task"}
            </button>

          </div>

        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.05] px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Create */}
        {showCreate && (
          <form
            onSubmit={createTask}
            className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6"
          >

            <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/25">
              New task
            </p>

            <div className="mt-5 grid gap-5">

              <input
                value={title}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
                placeholder="Task title"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/20 focus:border-cyan-400/40"
              />

              <textarea
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Describe what needs to be done..."
                rows={4}
                className="resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/20 focus:border-cyan-400/40"
              />

              <div className="grid gap-4 sm:grid-cols-2">

                <select
                  value={priority}
                  onChange={(event) =>
                    setPriority(
                      event.target.value,
                    )
                  }
                  className="rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm outline-none"
                >
                  <option value="low">
                    Low priority
                  </option>

                  <option value="normal">
                    Normal priority
                  </option>

                  <option value="high">
                    High priority
                  </option>

                  <option value="urgent">
                    Urgent
                  </option>
                </select>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                    Due date & time
                  </label>

                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(event) =>
                      setDueAt(
                        event.target.value,
                      )
                    }
                    required
                    className="w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm outline-none focus:border-cyan-400/40"
                  />

                  <p className="mt-2 text-[10px] text-white/20">
                    Kuba will use this exact date and time as the task deadline.
                  </p>
                </div>

              </div>

              <div className="flex justify-end">

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !title.trim() ||
                    !dueAt
                  }
                  className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving
                    ? "Creating..."
                    : "Create Task"}
                </button>

              </div>

            </div>
          </form>
        )}

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <Stat
            label="Total"
            value={stats.total}
          />

          <Stat
            label="Pending"
            value={stats.pending}
          />

          <Stat
            label="In Progress"
            value={
              stats.inProgress
            }
          />

          <Stat
            label="Completed"
            value={
              stats.completed
            }
          />

          <Stat
            label="Urgent"
            value={stats.urgent}
          />

        </div>

        {/* Task list */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">

          <div className="border-b border-white/10 px-6 py-5">
            <h2 className="text-lg font-bold">
              Task queue
            </h2>

            <p className="mt-1 text-xs text-white/25">
              Work waiting for people or AI
              employees.
            </p>
          </div>

          {loading ? (
            <div className="p-12 text-center text-sm text-white/30">
              Loading tasks...
            </div>
          ) : tasks.length === 0 ? (
            <EmptyState
              icon="✓"
              title="Keep every priority moving"
              description="Create work for your team or let SuperKuba generate tasks automatically from customer and business activity."
              actionLabel="Create Task"
              onAction={() => setShowCreate(true)}
              secondaryLabel="Explore Automations"
              secondaryHref="/dashboard/automations"
              className="m-5"
            />
          ) : (
            <div className="divide-y divide-white/10">

              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between"
                >

                  <div className="min-w-0">

                    <div className="flex flex-wrap items-center gap-2">

                      <h3
                        className={`text-sm font-bold ${
                          task.status ===
                          "completed"
                            ? "text-white/35 line-through"
                            : "text-white"
                        }`}
                      >
                        {task.title}
                      </h3>

                      <PriorityBadge
                        priority={
                          task.priority
                        }
                      />

                    </div>

                    {task.description && (
                      <p className="mt-2 max-w-2xl text-xs leading-5 text-white/30">
                        {task.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-white/20">

                      {task.assignedEmployeeId && (
                        <span>
                          AI employee assigned
                        </span>
                      )}

                      {task.assignedUserId && (
                        <span>
                          Human assigned
                        </span>
                      )}

                      {task.leadId && (
                        <span>
                          Lead task
                        </span>
                      )}

                      {task.automationId && (
                        <span>
                          Automation created
                        </span>
                      )}

                      {task.dueAt && (
                        <span>
                          Due{" "}
                          {formatDate(
                            task.dueAt,
                          )}
                        </span>
                      )}

                    </div>

                  </div>

                  <div className="flex flex-wrap items-center gap-3">

                    <select
                      value={task.status}
                      onChange={(event) =>
                        updateTask(
                          task.id,
                          {
                            status:
                              event.target
                                .value,
                          },
                        )
                      }
                      className="rounded-xl border border-white/10 bg-[#0b0b0f] px-3 py-2 text-xs outline-none"
                    >
                      <option value="pending">
                        Pending
                      </option>

                      <option value="in_progress">
                        In Progress
                      </option>

                      <option value="completed">
                        Completed
                      </option>

                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        deleteTask(
                          task.id,
                        )
                      }
                      className="rounded-xl border border-red-400/10 px-3 py-2 text-xs text-red-300/60 transition hover:border-red-400/20 hover:text-red-300"
                    >
                      Delete
                    </button>

                  </div>

                </div>
              ))}

            </div>
          )}

        </section>

      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.02] p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
        {label}
      </p>

      <p className="mt-3 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function PriorityBadge({
  priority,
}: {
  priority: string;
}) {
  const classes =
    priority === "urgent"
      ? "border-red-400/20 bg-red-400/[0.05] text-red-300"
      : priority === "high"
        ? "border-amber-400/20 bg-amber-400/[0.05] text-amber-300"
        : priority === "low"
          ? "border-white/10 bg-white/[0.03] text-white/30"
          : "border-cyan-400/15 bg-cyan-400/[0.04] text-cyan-300/70";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${classes}`}
    >
      {priorityLabels[priority] ||
        priority}
    </span>
  );
}

function formatDate(
  value: string,
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}
