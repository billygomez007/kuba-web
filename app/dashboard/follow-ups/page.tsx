"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/EmptyState";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  stage: string;
};

type FollowUp = {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  dueAt: string | number | Date;
  status: string;
};

type FollowUpResult = {
  followUp: FollowUp;
  lead: Lead | null;
};

export default function FollowUpsPage() {
  const [items, setItems] = useState<FollowUpResult[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");

  async function loadData() {
    try {
      const [followUpsResponse, leadsResponse] = await Promise.all([
        fetch("/api/follow-ups", {
          cache: "no-store",
        }),
        fetch("/api/leads", {
          cache: "no-store",
        }),
      ]);

      if (!followUpsResponse.ok || !leadsResponse.ok) {
        throw new Error("Unable to load sales workflow.");
      }

      const followUpsData = await followUpsResponse.json();
      const leadsData = await leadsResponse.json();

      setLeads(leadsData.leads ?? []);
      setItems(followUpsData.followUps ?? []);
    } catch (error) {
      console.error("Follow-up loading error:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter(({ followUp, lead }) =>
      [
        followUp.title,
        followUp.description,
        lead?.name,
        lead?.email,
        followUp.status,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(query),
        ),
    );
  }, [items, search]);

  const pending = items.filter(
    ({ followUp }) => followUp.status === "pending",
  );

  const completed = items.filter(
    ({ followUp }) => followUp.status === "completed",
  );

  const overdue = items.filter(({ followUp }) => {
    if (followUp.status === "completed") {
      return false;
    }

    const time = new Date(followUp.dueAt).getTime();

    return !Number.isNaN(time) && time < Date.now();
  });

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.05] blur-[150px]" />
        <div className="absolute right-[-150px] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.05] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1400px] px-6 py-10 lg:px-10 lg:py-14">
        <section className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
              Sales workflow
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Follow-ups
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-white/40">
              Never lose track of the next action required to move a
              customer or opportunity forward.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
          >
            + Create follow-up
          </button>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <Stat
            label="Open"
            value={String(pending.length)}
            description="Pending follow-ups"
          />

          <Stat
            label="Overdue"
            value={String(overdue.length)}
            description="Need attention"
          />

          <Stat
            label="Completed"
            value={String(completed.length)}
            description="Finished follow-ups"
          />
        </section>

        <section className="mt-14">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
                Your sales queue
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Follow-up queue
              </h2>
            </div>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search follow-ups..."
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/40 sm:w-80"
            />
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
            {loading ? (
              <div className="p-12 text-center text-sm text-white/30">
                Loading follow-ups...
              </div>
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon="↻"
                title="Never let a promising customer go cold"
                description="Schedule the next touchpoint or let your AI Sales Assistant keep every lead moving at the right time."
                actionLabel="Create Follow-up"
                onAction={() => setShowForm(true)}
                secondaryLabel="View Sales"
                secondaryHref="/dashboard/sales"
                className="m-5"
              />
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filteredItems.map((item) => (
                  <FollowUpCard
                    key={item.followUp.id}
                    item={item}
                    onStatusChange={async (id, status) => {
                      try {
                        const response = await fetch(
                          `/api/follow-ups/${id}`,
                          {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ status }),
                          },
                        );

                        if (!response.ok) {
                          throw new Error(
                            "Unable to update follow-up.",
                          );
                        }

                        setItems((current) =>
                          current.map((entry) =>
                            entry.followUp.id === id
                              ? {
                                  ...entry,
                                  followUp: {
                                    ...entry.followUp,
                                    status,
                                    updatedAt: new Date(),
                                  },
                                }
                              : entry,
                          ),
                        );
                      } catch (error) {
                        console.error(
                          "Follow-up status update error:",
                          error,
                        );
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="relative mt-14 overflow-hidden rounded-[32px] border border-violet-400/10 bg-violet-400/[0.025] p-8 sm:p-10">
          <div className="pointer-events-none absolute right-[-100px] top-[-150px] h-[450px] w-[450px] rounded-full bg-violet-600/10 blur-[120px]" />

          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
              Kuba Sales
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em]">
              Follow-up is where AI sales becomes execution.
            </h2>

            <p className="mt-5 text-sm leading-7 text-white/40">
              Kuba should not simply tell you that a lead needs attention.
              It should understand the opportunity, determine the next
              action, create the follow-up, and eventually execute that
              action through the appropriate channel.
            </p>
          </div>
        </section>
      </div>

      {showForm && (
        <CreateFollowUpModal
          leads={leads}
          onClose={() => setShowForm(false)}
          onCreated={(item) => {
            setItems((current) => [item, ...current]);
            setShowForm(false);
          }}
        />
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <p className="text-sm text-white/40">{label}</p>

      <p className="mt-4 text-3xl font-black">{value}</p>

      <p className="mt-1 text-xs text-white/25">{description}</p>
    </div>
  );
}

function FollowUpCard({
  item,
  onStatusChange,
}: {
  item: FollowUpResult;
  onStatusChange: (id: string, status: string) => void;
}) {
  const { followUp, lead } = item;

  const date = new Date(followUp.dueAt);

  const isOverdue =
    followUp.status !== "completed" &&
    !Number.isNaN(date.getTime()) &&
    date.getTime() < Date.now();

  return (
    <div className="flex flex-col justify-between gap-5 p-6 transition hover:bg-white/[0.02] lg:flex-row lg:items-center">
      <div className="flex items-start gap-4">
        <div
          className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
            isOverdue
              ? "border-red-400/20 bg-red-400/[0.06] text-red-300"
              : "border-cyan-400/15 bg-cyan-400/[0.05] text-cyan-300"
          }`}
        >
          {isOverdue ? "!" : "✓"}
        </div>

        <div>
          <h3 className="text-sm font-bold text-white/85">
            {followUp.title}
          </h3>

          <p className="mt-1 text-xs text-cyan-300/50">
            {lead?.name || "Unnamed lead"}
          </p>

          {followUp.description && (
            <p className="mt-2 max-w-2xl text-xs leading-5 text-white/30">
              {followUp.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
            isOverdue
              ? "border-red-400/15 bg-red-400/[0.05] text-red-300"
              : followUp.status === "completed"
                ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-white/35"
          }`}
        >
          {isOverdue ? "Overdue" : followUp.status}
        </span>

        <span className="text-xs text-white/30">
          {Number.isNaN(date.getTime())
            ? "No date"
            : date.toLocaleString()}
        </span>

        <button
          type="button"
          onClick={() =>
            onStatusChange(
              followUp.id,
              followUp.status === "completed"
                ? "pending"
                : "completed",
            )
          }
          className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/50 transition hover:bg-white/[0.08] hover:text-white"
        >
          {followUp.status === "completed"
            ? "Reopen"
            : "Complete"}
        </button>
      </div>
    </div>
  );
}

function CreateFollowUpModal({
  leads,
  onClose,
  onCreated,
}: {
  leads: Lead[];
  onClose: () => void;
  onCreated: (item: FollowUpResult) => void;
}) {
  const [leadId, setLeadId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      if (!leadId) {
        throw new Error("Select a lead before creating the follow-up.");
      }

      if (!title.trim()) {
        throw new Error("Enter a follow-up title.");
      }

      if (!dueAt) {
        throw new Error("Select a due date and time.");
      }

      const response = await fetch("/api/follow-ups", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadId,
          title,
          description,
          dueAt,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to create follow-up.",
        );
      }

      const lead =
        leads.find((item) => item.id === leadId) || null;

      onCreated({
        followUp: data.followUp,
        lead,
      });
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to create follow-up.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b0b0f] p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">
              Sales workflow
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Create follow-up
            </h2>

            <p className="mt-2 text-sm text-white/35">
              Tell Kuba what needs to happen next.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-white"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="mt-7 space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm font-semibold text-white/70">
              Lead
            </label>

            {leads.length === 0 ? (
              <div className="rounded-xl border border-amber-400/10 bg-amber-400/[0.04] px-4 py-3 text-xs leading-5 text-amber-300/70">
                There are no leads yet. Go to Sales and create a lead first.
              </div>
            ) : (
              <select
                required
                value={leadId}
                onChange={(event) =>
                  setLeadId(event.target.value)
                }
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
              >
                <option value="">Select a lead</option>

                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.name ||
                      lead.email ||
                      lead.phone ||
                      "Unnamed lead"}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/70">
              Follow-up title
            </label>

            <input
              required
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="Call John about his proposal"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/70">
              Due date and time
            </label>

            <input
              required
              type="datetime-local"
              value={dueAt}
              onChange={(event) =>
                setDueAt(event.target.value)
              }
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/70">
              Description
            </label>

            <textarea
              value={description}
              onChange={(event) =>
                setDescription(event.target.value)
              }
              rows={3}
              placeholder="What should happen during this follow-up?"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-cyan-400/40"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/10 bg-red-400/[0.06] px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 border-t border-white/[0.07] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/50 hover:text-white"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading || leads.length === 0}
              className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create follow-up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
