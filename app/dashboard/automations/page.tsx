"use client";

import {
  useEffect,
  useState,
} from "react";

type Condition = {
  field: string;
  operator: string;
  value: string;
};

type Action = {
  type: string;
  employeeType?: string;
  title?: string;
  description?: string;
  delayMinutes?: number;
  priority?: "low" | "normal" | "high" | "urgent";
  assignToEmployeeType?: string;
};

type Automation = {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  conditions: Condition[];
  actions: Action[];
  status: string;
  createdAt: string;
  updatedAt: string;
};

type AutomationRun = {
  id: string;
  automationId: string;
  automationName: string;
  triggerType: string;
  triggerData: string;
  status: string;
  error: string | null;
  startedAt: string;
  completedAt: string | null;
};

const triggerOptions = [
  {
    value: "lead.created",
    label: "New lead created",
  },
  {
    value: "lead.updated",
    label: "Lead updated",
  },
  {
    value: "follow_up.due",
    label: "Follow-up becomes due",
  },
];

const employeeOptions = [
  {
    value: "sales",
    label: "Sales AI",
  },
  {
    value: "receptionist",
    label: "Receptionist AI",
  },
  {
    value: "customer-support",
    label: "Customer Support AI",
  },
  {
    value: "general-manager",
    label: "General Manager AI",
  },
];

export default function AutomationsPage() {
  const [automations, setAutomations] =
    useState<Automation[]>([]);

  const [runs, setRuns] =
    useState<AutomationRun[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [runsLoading, setRunsLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [showBuilder, setShowBuilder] =
    useState(false);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [trigger, setTrigger] =
    useState("lead.created");

  const [conditions, setConditions] =
    useState<Condition[]>([]);

  const [actions, setActions] =
    useState<Action[]>([
      {
        type: "assign_employee",
        employeeType: "sales",
      },
    ]);

  useEffect(() => {
    loadAutomations();
    loadRuns();
  }, []);

  async function loadAutomations() {
    try {
      const response =
        await fetch("/api/automations");

      const data =
        await response.json();

      if (response.ok) {
        setAutomations(
          data.automations || [],
        );
      }
    } catch {
      setMessage(
        "Unable to load automations.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadRuns() {
    try {
      const response =
        await fetch(
          "/api/automations/runs",
        );

      const data =
        await response.json();

      if (response.ok) {
        setRuns(
          data.runs || [],
        );
      }
    } catch {
      setMessage(
        "Unable to load automation history.",
      );
    } finally {
      setRunsLoading(false);
    }
  }

  function resetBuilder() {
    setName("");
    setDescription("");
    setTrigger("lead.created");
    setConditions([]);
    setActions([
      {
        type: "assign_employee",
        employeeType: "sales",
      },
    ]);
  }

  function addCondition() {
    setConditions((current) => [
      ...current,
      {
        field: "lead.stage",
        operator: "equals",
        value: "",
      },
    ]);
  }

  function updateCondition(
    index: number,
    field: keyof Condition,
    value: string,
  ) {
    setConditions((current) =>
      current.map((condition, i) =>
        i === index
          ? {
              ...condition,
              [field]: value,
            }
          : condition,
      ),
    );
  }

  function removeCondition(index: number) {
    setConditions((current) =>
      current.filter(
        (_, i) => i !== index,
      ),
    );
  }

  function addAction() {
    setActions((current) => [
      ...current,
      {
        type: "create_follow_up",
        title: "Follow up with new lead",
        description:
          "Follow up with the lead.",
        delayMinutes: 60,
      },
    ]);
  }

  function updateAction(
    index: number,
    patch: Partial<Action>,
  ) {
    setActions((current) =>
      current.map((action, i) =>
        i === index
          ? {
              ...action,
              ...patch,
            }
          : action,
      ),
    );
  }

  function removeAction(index: number) {
    setActions((current) =>
      current.filter(
        (_, i) => i !== index,
      ),
    );
  }

  async function createAutomation() {
    if (!name.trim()) {
      setMessage(
        "Give the automation a name.",
      );
      return;
    }

    if (actions.length === 0) {
      setMessage(
        "Add at least one action.",
      );
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response =
        await fetch(
          "/api/automations",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              name: name.trim(),
              description:
                description.trim() ||
                null,
              trigger,
              conditions,
              actions,
              status: "active",
            }),
          },
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create automation.",
        );
      }

      setMessage(
        "Automation created successfully.",
      );

      resetBuilder();
      setShowBuilder(false);

      await loadAutomations();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to create automation.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleAutomation(
    automation: Automation,
  ) {
    const nextStatus =
      automation.status === "active"
        ? "paused"
        : "active";

    try {
      const response =
        await fetch(
          "/api/automations",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              id: automation.id,
              status: nextStatus,
            }),
          },
        );

      if (!response.ok) {
        const data =
          await response.json();

        throw new Error(
          data.error ||
            "Unable to update automation.",
        );
      }

      await loadAutomations();

      setMessage(
        nextStatus === "active"
          ? "Automation activated."
          : "Automation paused.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update automation.",
      );
    }
  }

  async function deleteAutomation(
    automationId: string,
  ) {
    const confirmed =
      window.confirm(
        "Delete this automation?",
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/automations?id=${encodeURIComponent(
            automationId,
          )}`,
          {
            method: "DELETE",
          },
        );

      if (!response.ok) {
        const data =
          await response.json();

        throw new Error(
          data.error ||
            "Unable to delete automation.",
        );
      }

      await loadAutomations();

      setMessage(
        "Automation deleted.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete automation.",
      );
    }
  }

  function formatDate(
    value: string | null,
  ) {
    if (!value) {
      return "Not completed";
    }

    return new Date(
      value,
    ).toLocaleString();
  }

  function statusClass(
    status: string,
  ) {
    if (status === "completed") {
      return "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300";
    }

    if (
      status === "failed" ||
      status === "error"
    ) {
      return "border-red-400/15 bg-red-400/[0.05] text-red-300";
    }

    return "border-amber-400/15 bg-amber-400/[0.05] text-amber-300";
  }

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-10 text-white sm:px-8 lg:px-10">

      <div className="mx-auto max-w-6xl">

        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/60">
              Kuba Automation Engine
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Automations
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/35">
              Let Kuba automatically handle
              repetitive business work when
              something happens.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetBuilder();
              setShowBuilder(true);
            }}
            className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-cyan-300"
          >
            + Create Automation
          </button>

        </div>


        {message && (
          <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
            {message}
          </div>
        )}


        {showBuilder && (
          <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/50">
                  Automation builder
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Tell Kuba what to do
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setShowBuilder(false)
                }
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/40 hover:text-white"
              >
                Close
              </button>
            </div>


            <div className="mt-8 grid gap-6">

              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Name
                </span>

                <input
                  value={name}
                  onChange={(event) =>
                    setName(
                      event.target.value,
                    )
                  }
                  placeholder="Example: Follow up every new lead"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/20 focus:border-cyan-400/40"
                />
              </label>


              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-white/30">
                  Description
                </span>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value,
                    )
                  }
                  placeholder="What should this automation accomplish?"
                  rows={3}
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/20 focus:border-cyan-400/40"
                />
              </label>


              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-white/30">
                  When this happens
                </span>

                <select
                  value={trigger}
                  onChange={(event) =>
                    setTrigger(
                      event.target.value,
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b0b0f] px-4 py-3 text-sm outline-none focus:border-cyan-400/40"
                >
                  {triggerOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </div>


              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/30">
                    Conditions
                  </span>

                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    + Add condition
                  </button>
                </div>

                {conditions.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-white/10 px-4 py-4 text-sm text-white/25">
                    No conditions. This automation
                    will run every time its trigger
                    occurs.
                  </div>
                ) : (
                  <div className="mt-3 space-y-3">
                    {conditions.map(
                      (
                        condition,
                        index,
                      ) => (
                        <div
                          key={index}
                          className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
                        >
                          <input
                            value={
                              condition.field
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCondition(
                                index,
                                "field",
                                event.target
                                  .value,
                              )
                            }
                            placeholder="lead.stage"
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                          />

                          <select
                            value={
                              condition.operator
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCondition(
                                index,
                                "operator",
                                event.target
                                  .value,
                              )
                            }
                            className="rounded-lg border border-white/10 bg-[#0b0b0f] px-3 py-2 text-sm outline-none"
                          >
                            <option value="equals">
                              equals
                            </option>
                            <option value="not_equals">
                              does not equal
                            </option>
                            <option value="contains">
                              contains
                            </option>
                          </select>

                          <input
                            value={
                              condition.value
                            }
                            onChange={(
                              event,
                            ) =>
                              updateCondition(
                                index,
                                "value",
                                event.target
                                  .value,
                              )
                            }
                            placeholder="new"
                            className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                          />

                          <button
                            type="button"
                            onClick={() =>
                              removeCondition(
                                index,
                              )
                            }
                            className="rounded-lg border border-red-400/10 px-3 py-2 text-xs text-red-300"
                          >
                            Remove
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>


              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/30">
                    Actions
                  </span>

                  <button
                    type="button"
                    onClick={addAction}
                    className="text-xs font-bold text-cyan-300 hover:text-cyan-200"
                  >
                    + Add action
                  </button>
                </div>

                <div className="mt-3 space-y-3">

                  {actions.map(
                    (
                      action,
                      index,
                    ) => (
                      <div
                        key={index}
                        className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                      >

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">

                          <select
                            value={
                              action.type
                            }
                            onChange={(
                              event,
                            ) => {
                              const type =
                                event.target
                                  .value;

                              if (
                                type ===
                                "assign_employee"
                              ) {
                                updateAction(
                                  index,
                                  {
                                    type,
                                    employeeType:
                                      "sales",
                                  },
                                );
                              } else if (
                                type ===
                                "create_follow_up"
                              ) {
                                updateAction(
                                  index,
                                  {
                                    type,
                                    title:
                                      "Follow up with lead",
                                    description:
                                      "Follow up with the lead.",
                                    delayMinutes:
                                      60,
                                  },
                                );
                              } else {
                                updateAction(
                                  index,
                                  {
                                    type,
                                    title:
                                      "Follow up with new lead",
                                    description:
                                      "Contact and qualify this lead.",
                                    priority:
                                      "normal",
                                    delayMinutes:
                                      60,
                                    assignToEmployeeType:
                                      "sales",
                                  },
                                );
                              }
                            }}
                            className="rounded-lg border border-white/10 bg-[#0b0b0f] px-3 py-2 text-sm outline-none"
                          >
                            <option value="assign_employee">
                              Assign AI employee
                            </option>

                            <option value="create_follow_up">
                              Create follow-up
                            </option>

                            <option value="create_task">
                              Create task
                            </option>
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              removeAction(
                                index,
                              )
                            }
                            className="rounded-lg border border-red-400/10 px-3 py-2 text-xs text-red-300 sm:ml-auto"
                          >
                            Remove
                          </button>

                        </div>


                        {action.type ===
                          "assign_employee" && (
                          <div className="mt-4">
                            <label className="text-xs text-white/30">
                              AI employee
                            </label>

                            <select
                              value={
                                action.employeeType ||
                                "sales"
                              }
                              onChange={(
                                event,
                              ) =>
                                updateAction(
                                  index,
                                  {
                                    employeeType:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0b0f] px-3 py-2 text-sm outline-none"
                            >
                              {employeeOptions.map(
                                (
                                  option,
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                  >
                                    {
                                      option.label
                                    }
                                  </option>
                                ),
                              )}
                            </select>
                          </div>
                        )}


                        {action.type ===
                          "create_follow_up" && (
                          <div className="mt-4 grid gap-4 sm:grid-cols-3">

                            <input
                              value={
                                action.title ||
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateAction(
                                  index,
                                  {
                                    title:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              placeholder="Follow-up title"
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                            />

                            <input
                              value={
                                action.description ||
                                ""
                              }
                              onChange={(
                                event,
                              ) =>
                                updateAction(
                                  index,
                                  {
                                    description:
                                      event
                                        .target
                                        .value,
                                  },
                                )
                              }
                              placeholder="Description"
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                            />

                            <input
                              type="number"
                              min="1"
                              value={
                                action.delayMinutes ??
                                60
                              }
                              onChange={(
                                event,
                              ) =>
                                updateAction(
                                  index,
                                  {
                                    delayMinutes:
                                      Number(
                                        event
                                          .target
                                          .value,
                                      ),
                                  },
                                )
                              }
                              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                            />

                          </div>
                        )}


                        {action.type ===
                          "create_task" && (
                          <div className="mt-4 grid gap-4">

                            <div className="grid gap-4 sm:grid-cols-2">

                              <div>
                                <label className="text-xs text-white/30">
                                  Task title
                                </label>

                                <input
                                  value={
                                    action.title ||
                                    ""
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateAction(
                                      index,
                                      {
                                        title:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  placeholder="Task title"
                                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-white/30">
                                  Priority
                                </label>

                                <select
                                  value={
                                    action.priority ||
                                    "normal"
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateAction(
                                      index,
                                      {
                                        priority:
                                          event
                                            .target
                                            .value as Action["priority"],
                                      },
                                    )
                                  }
                                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0b0f] px-3 py-2 text-sm outline-none"
                                >
                                  <option value="low">
                                    Low
                                  </option>

                                  <option value="normal">
                                    Normal
                                  </option>

                                  <option value="high">
                                    High
                                  </option>

                                  <option value="urgent">
                                    Urgent
                                  </option>
                                </select>
                              </div>

                            </div>

                            <div>
                              <label className="text-xs text-white/30">
                                Description
                              </label>

                              <textarea
                                value={
                                  action.description ||
                                  ""
                                }
                                onChange={(
                                  event,
                                ) =>
                                  updateAction(
                                    index,
                                    {
                                      description:
                                        event
                                          .target
                                          .value,
                                    },
                                  )
                                }
                                rows={3}
                                placeholder="What should be done?"
                                className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                              />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">

                              <div>
                                <label className="text-xs text-white/30">
                                  Due after
                                </label>

                                <div className="mt-2 flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    value={
                                      action.delayMinutes ??
                                      60
                                    }
                                    onChange={(
                                      event,
                                    ) =>
                                      updateAction(
                                        index,
                                        {
                                          delayMinutes:
                                            Number(
                                              event
                                                .target
                                                .value,
                                            ),
                                        },
                                      )
                                    }
                                    className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none"
                                  />

                                  <span className="text-xs text-white/30">
                                    minutes
                                  </span>
                                </div>
                              </div>

                              <div>
                                <label className="text-xs text-white/30">
                                  Assign to AI employee
                                </label>

                                <select
                                  value={
                                    action.assignToEmployeeType ||
                                    "sales"
                                  }
                                  onChange={(
                                    event,
                                  ) =>
                                    updateAction(
                                      index,
                                      {
                                        assignToEmployeeType:
                                          event
                                            .target
                                            .value,
                                      },
                                    )
                                  }
                                  className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b0b0f] px-3 py-2 text-sm outline-none"
                                >
                                  {employeeOptions.map(
                                    (
                                      option,
                                    ) => (
                                      <option
                                        key={
                                          option.value
                                        }
                                        value={
                                          option.value
                                        }
                                      >
                                        {
                                          option.label
                                        }
                                      </option>
                                    ),
                                  )}
                                </select>
                              </div>

                            </div>

                          </div>
                        )}

                      </div>
                    ),
                  )}

                </div>
              </div>


              <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  onClick={() =>
                    setShowBuilder(false)
                  }
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/50 hover:text-white"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={
                    createAutomation
                  }
                  className="rounded-xl bg-cyan-400 px-6 py-3 text-sm font-bold text-black hover:bg-cyan-300 disabled:opacity-40"
                >
                  {saving
                    ? "Creating..."
                    : "Create Automation"}
                </button>

              </div>

            </div>
          </section>
        )}


        <section className="mt-10">

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
              Active workflows
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Your automations
            </h2>
          </div>


          {loading ? (
            <div className="rounded-3xl border border-white/10 p-8 text-sm text-white/30">
              Loading automations...
            </div>
          ) : automations.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
              <div className="text-3xl">
                ⌁
              </div>

              <h3 className="mt-4 font-bold">
                No automations yet
              </h3>

              <p className="mt-2 text-sm text-white/30">
                Create your first workflow
                and let Kuba handle repetitive
                work automatically.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {automations.map(
                (automation) => (
                  <div
                    key={automation.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <h3 className="font-bold">
                            {
                              automation.name
                            }
                          </h3>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                              automation.status ===
                              "active"
                                ? "border-emerald-400/15 bg-emerald-400/[0.05] text-emerald-300"
                                : "border-amber-400/15 bg-amber-400/[0.05] text-amber-300"
                            }`}
                          >
                            {
                              automation.status
                            }
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-white/30">
                          {
                            automation.description ||
                            "No description"
                          }
                        </p>

                        <p className="mt-2 text-xs text-white/20">
                          Trigger:{" "}
                          {
                            automation.trigger
                          }
                          {" · "}
                          {
                            automation.actions
                              ?.length || 0
                          }{" "}
                          action(s)
                        </p>
                      </div>


                      <div className="flex shrink-0 gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            toggleAutomation(
                              automation,
                            )
                          }
                          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-white/50 hover:text-white"
                        >
                          {automation.status ===
                          "active"
                            ? "Pause"
                            : "Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteAutomation(
                              automation.id,
                            )
                          }
                          className="rounded-lg border border-red-400/10 px-3 py-2 text-xs font-bold text-red-300"
                        >
                          Delete
                        </button>

                      </div>

                    </div>

                  </div>
                ),
              )}
            </div>
          )}

        </section>


        <section className="mt-14">

          <div className="mb-5">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/25">
              Execution history
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Automation runs
            </h2>

            <p className="mt-2 text-sm text-white/30">
              See what Kuba actually executed,
              when it happened, and whether it
              succeeded.
            </p>
          </div>


          {runsLoading ? (
            <div className="rounded-3xl border border-white/10 p-8 text-sm text-white/30">
              Loading automation history...
            </div>
          ) : runs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
              <div className="text-3xl">
                ◷
              </div>

              <h3 className="mt-4 font-bold">
                No automation runs yet
              </h3>

              <p className="mt-2 text-sm text-white/30">
                Once Kuba executes an automation,
                the run will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02]">

              {runs.map(
                (run, index) => (
                  <div
                    key={run.id}
                    className={`p-5 ${
                      index > 0
                        ? "border-t border-white/10"
                        : ""
                    }`}
                  >

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                      <div className="min-w-0">

                        <div className="flex flex-wrap items-center gap-3">

                          <h3 className="font-bold">
                            {
                              run.automationName
                            }
                          </h3>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass(
                              run.status,
                            )}`}
                          >
                            {
                              run.status
                            }
                          </span>

                        </div>

                        <p className="mt-2 text-xs text-white/30">
                          Trigger:{" "}
                          {
                            run.triggerType
                          }
                        </p>

                        {run.error && (
                          <p className="mt-2 text-xs text-red-300/70">
                            {run.error}
                          </p>
                        )}

                      </div>


                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-xs text-white/30">
                          Started
                        </p>

                        <p className="mt-1 text-xs text-white/50">
                          {formatDate(
                            run.startedAt,
                          )}
                        </p>

                        <p className="mt-3 text-xs text-white/30">
                          Completed
                        </p>

                        <p className="mt-1 text-xs text-white/50">
                          {formatDate(
                            run.completedAt,
                          )}
                        </p>
                      </div>

                    </div>

                  </div>
                ),
              )}

            </div>
          )}

        </section>


        <section className="mt-14 rounded-3xl border border-white/10 bg-white/[0.02] p-7 sm:p-8">

          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/50">
            Kuba automation architecture
          </p>

          <h2 className="mt-3 text-2xl font-black">
            Events become actions
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/35">
            A business event can trigger a
            workflow. Conditions determine
            whether it should run, and actions
            tell Kuba what to do next.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/50">
              Event
            </span>

            <span className="text-white/20">
              →
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/50">
              Conditions
            </span>

            <span className="text-white/20">
              →
            </span>

            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/50">
              AI Action
            </span>

            <span className="text-white/20">
              →
            </span>

            <span className="rounded-full border border-cyan-400/15 bg-cyan-400/[0.05] px-3 py-1.5 text-cyan-300/70">
              Result
            </span>
          </div>

        </section>

      </div>

    </main>
  );
}
