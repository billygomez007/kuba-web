"use client";

import { FormEvent, useEffect, useState } from "react";

type Lead = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  service: string | null;
  destination: string | null;
  intent: string | null;
  notes: string | null;
  studyLevel: string | null;
  program: string | null;
  university: string | null;
  preferredIntake: string | null;
  budget: string | null;
  source: string | null;
  stage: string;
  assignedEmployeeId: string | null;
  createdAt: string | number | Date;
  updatedAt: string | number | Date;
  customerId: string | null;
};

type Message = {
  role: "user" | "assistant";
  content: string;
};

type SalesActivity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string | number | Date;
};

type SalesFollowUp = {
  id: string;
  leadId: string;
  title: string;
  description: string | null;
  dueAt: string | number | Date;
  status: string;
  createdAt: string | number | Date;
};

type SalesPriority = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  score: number;
  reasons: string[];
  pendingFollowUps: number;
  overdueFollowUps: number;
};

type SalesPrioritySummary = {
  totalLeads: number;
  stageCounts: Record<string, number>;
  qualifiedLeads: number;
  convertedLeads: number;
  pendingFollowUps: number;
  completedFollowUps: number;
  overdueFollowUps: number;
  upcomingFollowUps: number;
};

export default function KubaSalesPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] =
    useState<Lead | null>(null);

  const [showLeadForm, setShowLeadForm] =
    useState(false);

  const [newLeadName, setNewLeadName] =
    useState("");

  const [newLeadEmail, setNewLeadEmail] =
    useState("");

  const [newLeadPhone, setNewLeadPhone] =
    useState("");


  const [activities, setActivities] =
    useState<SalesActivity[]>([]);

  const [activitiesLoading, setActivitiesLoading] =
    useState(false);

  const [followUps, setFollowUps] =
    useState<SalesFollowUp[]>([]);

  const [followUpsLoading, setFollowUpsLoading] =
    useState(false);

  const [priorities, setPriorities] =
    useState<SalesPriority[]>([]);

  const [prioritySummary, setPrioritySummary] =
    useState<SalesPrioritySummary | null>(null);

  const [prioritiesLoading, setPrioritiesLoading] =
    useState(true);

  const [leadsLoading, setLeadsLoading] =
    useState(true);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi. I'm Kuba Sales, your AI sales employee. Tell me what you'd like me to work on.",
    },
  ]);

  const [briefing, setBriefing] = useState<any>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);

  const [memoryLoading, setMemoryLoading] = useState(true);


  useEffect(() => {
    async function loadSalesMemory() {
      try {
        const response = await fetch(
          "/api/ai/conversations",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        if (data.messages?.length) {
          setMessages(
            data.messages.map((item: any) => ({
              role:
                item.direction === "inbound"
                  ? "user"
                  : "assistant",
              content: item.content,
            })),
          );
        }
      } catch (error) {
        console.error(
          "Unable to load Kuba Sales memory:",
          error,
        );
      } finally {
        setMemoryLoading(false);
      }
    }

    loadSalesMemory();
  }, []);


  useEffect(() => {
    async function loadBriefing() {
      try {
        const response = await fetch(
          "/api/ai/sales/briefing",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const data = await response.json();

        setBriefing(data);
      } catch (error) {
        console.error(
          "Briefing loading error:",
          error,
        );
      } finally {
        setBriefingLoading(false);
      }
    }

    loadBriefing();
  }, []);

  async function loadActivities(leadId: string) {
    try {
      setActivitiesLoading(true);

      const response = await fetch(
        `/api/ai/sales/activities?leadId=${encodeURIComponent(leadId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load sales activities.",
        );
      }

      setActivities(data.activities || []);
    } catch (error) {
      console.error(
        "Failed to load sales activities:",
        error,
      );

      setActivities([]);
    } finally {
      setActivitiesLoading(false);
    }
  }

  async function loadFollowUps(leadId: string) {
    try {
      setFollowUpsLoading(true);

      const response = await fetch(
        `/api/ai/sales/follow-ups?leadId=${encodeURIComponent(leadId)}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load follow-ups.",
        );
      }

      setFollowUps(data.followUps || []);
    } catch (error) {
      console.error(
        "Failed to load follow-ups:",
        error,
      );

      setFollowUps([]);
    } finally {
      setFollowUpsLoading(false);
    }
  }

  async function loadPriorities() {
    try {
      setPrioritiesLoading(true);

      const response = await fetch(
        "/api/ai/sales/priority",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Could not load sales priorities.",
        );
      }

      setPriorities(
        data.priorities || [],
      );

      setPrioritySummary(
        data.summary || null,
      );
    } catch (error) {
      console.error(
        "Failed to load sales priorities:",
        error,
      );

      setPriorities([]);
      setPrioritySummary(null);
    } finally {
      setPrioritiesLoading(false);
    }
  }

  async function loadLeads() {
    try {
      setLeadsLoading(true);

      const response = await fetch(
        "/api/ai/sales/leads",
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Could not load leads.",
        );
      }

      const loadedLeads = data.leads || [];

      setLeads(loadedLeads);

      if (selectedLead) {
        const updatedSelectedLead =
          loadedLeads.find(
            (lead: Lead) =>
              lead.id === selectedLead.id,
          );

        setSelectedLead(
          updatedSelectedLead || null,
        );
      }
    } catch (error) {
      console.error(
        "Failed to load leads:",
        error,
      );
    } finally {
      setLeadsLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    if (selectedLead) {
      loadActivities(selectedLead.id);
      loadFollowUps(selectedLead.id);
    } else {
      setActivities([]);
      setFollowUps([]);
    }
  }, [selectedLead?.id]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedMessage = message.trim();

    if (!trimmedMessage || loading) {
      return;
    }

    setMessage("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        content: trimmedMessage,
      },
    ]);

    setLoading(true);

    try {
      const response = await fetch(
        "/api/ai/sales",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmedMessage,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Kuba Sales could not respond.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response,
        },
      ]);

      await loadLeads();
      await loadPriorities();

      if (selectedLead?.id) {
        await loadActivities(selectedLead.id);
        await loadFollowUps(selectedLead.id);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function formatService(
    service: string | null,
  ) {
    if (!service) {
      return "Service not specified";
    }

    return service
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase(),
      );
  }

  function formatStage(stage: string) {
    return stage
      .replace(/_/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase(),
      );
  }

  useEffect(() => {
    loadPriorities();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-bold text-white">
              K
            </div>

            <div>
              <h1 className="font-bold text-slate-950">
                Kuba Sales
              </h1>

              <p className="text-xs text-slate-500">
                AI Sales Employee
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Active
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px]">
        <aside className="hidden min-h-[calc(100vh-73px)] w-64 border-r border-slate-200 bg-white p-5 lg:block">
          <a
            href="/dashboard"
            className="block rounded-xl px-4 py-3 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            ← Dashboard
          </a>

          <div className="mt-6">
            <p className="px-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Kuba Sales
            </p>

            <div className="mt-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
              Workspace
            </div>

            <div className="mt-1 rounded-xl px-4 py-3 text-sm text-slate-600">
              Leads
            </div>

            <div className="mt-1 rounded-xl px-4 py-3 text-sm text-slate-600">
              Follow-ups
            </div>

            <div className="mt-1 rounded-xl px-4 py-3 text-sm text-slate-600">
              Settings
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white px-6 py-5">
            <h2 className="text-xl font-bold text-slate-950">
              Sales workspace
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Manage leads and work with Kuba Sales.
            </p>
          </div>

          <section className="border-b border-slate-200 bg-slate-50 px-6 py-5">
            <div className="mx-auto max-w-[1500px]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Kuba Intelligence
                  </p>

                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    Today's sales priorities
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    The leads Kuba thinks deserve your attention first.
                  </p>
                </div>

                {prioritySummary && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">
                        Leads
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {prioritySummary.totalLeads}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">
                        Qualified
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {prioritySummary.qualifiedLeads}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs text-slate-400">
                        Pending
                      </p>

                      <p className="mt-1 text-lg font-bold text-slate-950">
                        {prioritySummary.pendingFollowUps}
                      </p>
                    </div>

                    <div className="rounded-xl border border-red-100 bg-white px-4 py-3">
                      <p className="text-xs text-red-400">
                        Overdue
                      </p>

                      <p className="mt-1 text-lg font-bold text-red-600">
                        {prioritySummary.overdueFollowUps}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {prioritiesLoading ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-400">
                  Kuba is analyzing the sales pipeline...
                </div>
              ) : priorities.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
                  No leads are currently available for prioritization.
                </div>
              ) : (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {priorities.slice(0, 3).map(
                    (priority, index) => (
                      <button
                        key={priority.id}
                        type="button"
                        onClick={() => {
                          const lead = leads.find(
                            (item) =>
                              item.id === priority.id,
                          );

                          if (lead) {
                            setSelectedLead(lead);
                          }
                        }}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">
                              {index + 1}
                            </div>

                            <div>
                              <p className="text-sm font-bold text-slate-950">
                                {priority.name ||
                                  "Unnamed lead"}
                              </p>

                              <p className="mt-0.5 text-xs capitalize text-slate-400">
                                {priority.stage}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {priority.score}
                          </div>
                        </div>

                        <div className="mt-3 space-y-1">
                          {priority.reasons
                            .slice(0, 2)
                            .map((reason) => (
                              <p
                                key={reason}
                                className="text-xs leading-5 text-slate-500"
                              >
                                • {reason}
                              </p>
                            ))}
                        </div>

                        {(priority.overdueFollowUps >
                          0 ||
                          priority.pendingFollowUps >
                            0) && (
                          <div className="mt-3 flex gap-2 text-xs">
                            {priority.overdueFollowUps >
                              0 && (
                              <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-600">
                                {
                                  priority.overdueFollowUps
                                }{" "}
                                overdue
                              </span>
                            )}

                            {priority.pendingFollowUps >
                              0 && (
                              <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700">
                                {
                                  priority.pendingFollowUps
                                }{" "}
                                pending
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="grid min-h-[calc(100vh-150px)] grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)]">

            {showLeadForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
                <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">

                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-950">
                      Create New Lead
                    </h2>

                    <button
                      type="button"
                      onClick={() => setShowLeadForm(false)}
                      className="text-sm text-slate-400 hover:text-slate-700"
                    >
                      Close
                    </button>
                  </div>

                  <form
                    onSubmit={async (event) => {
                      event.preventDefault();

                      const response = await fetch(
                        "/api/leads",
                        {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                          },
                          body: JSON.stringify({
                            name: newLeadName,
                            email: newLeadEmail,
                            phone: newLeadPhone,
                          }),
                        },
                      );

                      if (response.ok) {
                        setShowLeadForm(false);
                        setNewLeadName("");
                        setNewLeadEmail("");
                        setNewLeadPhone("");
                        await loadLeads();
                      }
                    }}
                    className="space-y-4"
                  >

                    <input
                      value={newLeadName}
                      onChange={(event) =>
                        setNewLeadName(event.target.value)
                      }
                      placeholder="Lead name"
                      required
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />

                    <input
                      value={newLeadEmail}
                      onChange={(event) =>
                        setNewLeadEmail(event.target.value)
                      }
                      placeholder="Email"
                      type="email"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />

                    <input
                      value={newLeadPhone}
                      onChange={(event) =>
                        setNewLeadPhone(event.target.value)
                      }
                      placeholder="Phone"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm"
                    />

                    <button
                      type="submit"
                      className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"
                    >
                      Create Lead
                    </button>

                  </form>
                </div>
              </div>
            )}

            <aside className="border-b border-slate-200 bg-white xl:border-b-0 xl:border-r">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                  <h3 className="font-bold text-slate-950">
                    Leads
                  </h3>

                  <p className="text-xs text-slate-500">
                    {leads.length} total
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLeadForm(true)}
                    className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    + New Lead
                  </button>

                  <button
                    type="button"
                    onClick={loadLeads}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <div className="max-h-[520px] overflow-y-auto xl:max-h-[calc(100vh-220px)]">
                {leadsLoading ? (
                  <div className="p-6 text-sm text-slate-500">
                    Loading leads...
                  </div>
                ) : leads.length === 0 ? (
                  <div className="p-6">
                    <p className="font-semibold text-slate-900">
                      No leads yet
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Leads captured by Kuba Receptionist will appear here.
                    </p>
                  </div>
                ) : (
                  leads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() =>
                        setSelectedLead(lead)
                      }
                      className={`w-full border-b border-slate-100 px-5 py-4 text-left transition hover:bg-slate-50 ${
                        selectedLead?.id === lead.id
                          ? "bg-slate-50"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">
                            {lead.name ||
                              "Unnamed lead"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatService(
                              lead.service,
                            )}

                            {lead.destination
                              ? ` • ${lead.destination}`
                              : ""}
                          </p>
                        </div>

                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                          {formatStage(
                            lead.stage,
                          )}
                        </span>
                      </div>

                      {lead.program && (
                        <p className="mt-2 truncate text-xs text-slate-600">
                          {lead.studyLevel
                            ? `${lead.studyLevel} • `
                            : ""}
                          {lead.program}
                        </p>
                      )}

                      {lead.budget && (
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          Budget: {lead.budget}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </aside>

            <div className="grid min-w-0 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px]">
              <section className="border-b border-slate-200 bg-slate-50 p-6 2xl:border-b-0 2xl:border-r">
                {selectedLead ? (
                  <div className="space-y-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                          Selected lead
                        </p>

                        <h3 className="mt-1 text-2xl font-bold text-slate-950">
                          {selectedLead.name ||
                            "Unnamed lead"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatService(
                            selectedLead.service,
                          )}

                          {selectedLead.destination
                            ? ` • ${selectedLead.destination}`
                            : ""}
                        </p>
                      </div>

                      <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200">
                        {formatStage(
                          selectedLead.stage,
                        )}
                      </span>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h4 className="text-sm font-bold text-slate-950">
                        Contact
                      </h4>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-400">
                            Email
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.email ||
                              "Not provided"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            Phone
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.phone ||
                              "Not provided"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h4 className="text-sm font-bold text-slate-950">
                        Interest
                      </h4>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-400">
                            Service
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {formatService(
                              selectedLead.service,
                            )}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            Destination
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.destination ||
                              "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h4 className="text-sm font-bold text-slate-950">
                        Academic profile
                      </h4>

                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs text-slate-400">
                            Study level
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.studyLevel ||
                              "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            Program
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.program ||
                              "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            University
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.university ||
                              "Not specified"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs text-slate-400">
                            Preferred intake
                          </p>

                          <p className="mt-1 text-sm text-slate-700">
                            {selectedLead.preferredIntake ||
                              "Not specified"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h4 className="text-sm font-bold text-slate-950">
                        Budget
                      </h4>

                      <p className="mt-2 text-xl font-bold text-slate-950">
                        {selectedLead.budget ||
                          "Not specified"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-950 p-5 text-white">
                      <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                        Lead intelligence
                      </p>

                      <p className="mt-3 text-sm leading-6 text-white/75">
                        {selectedLead.notes ||
                          selectedLead.intent ||
                          "Kuba has not captured enough information to summarize this lead yet."}
                      </p>
                    </div>


                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-950">
                            Sales activity
                          </h4>

                          <p className="mt-1 text-xs text-slate-400">
                            Recorded interactions with this lead
                          </p>
                        </div>

                        {activitiesLoading && (
                          <span className="text-xs text-slate-400">
                            Loading...
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        {!activitiesLoading &&
                          activities.length === 0 && (
                            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                              No sales activity has been recorded yet.
                            </div>
                          )}

                        {activities.map((activity) => (
                          <div
                            key={activity.id}
                            className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm shadow-sm ring-1 ring-slate-200">
                                {activity.type === "call"
                                  ? "☎"
                                  : activity.type === "email"
                                    ? "✉"
                                    : activity.type === "meeting"
                                      ? "◉"
                                      : "•"}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-slate-950">
                                      {activity.title}
                                    </p>

                                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                                      {activity.type}
                                    </p>
                                  </div>

                                  <span className="shrink-0 text-xs text-slate-400">
                                    {new Date(
                                      activity.createdAt,
                                    ).toLocaleString()}
                                  </span>
                                </div>

                                {activity.description && (
                                  <p className="mt-2 text-sm leading-6 text-slate-600">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>


                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-950">
                            Follow-ups
                          </h4>

                          <p className="mt-1 text-xs text-slate-400">
                            Scheduled actions for this lead
                          </p>
                        </div>

                        {followUpsLoading && (
                          <span className="text-xs text-slate-400">
                            Loading...
                          </span>
                        )}
                      </div>

                      <div className="mt-4 space-y-3">
                        {!followUpsLoading &&
                          followUps.length === 0 && (
                            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
                              No follow-ups have been scheduled.
                            </div>
                          )}

                        {followUps.map((followUp) => {
                          const dueDate = new Date(
                            followUp.dueAt,
                          );

                          const isOverdue =
                            followUp.status === "pending" &&
                            dueDate.getTime() < Date.now();

                          return (
                            <div
                              key={followUp.id}
                              className="rounded-xl border border-slate-100 bg-slate-50 p-4"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sm shadow-sm ring-1 ring-slate-200">
                                  ✓
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-950">
                                        {followUp.title}
                                      </p>

                                      <p
                                        className={`mt-1 text-xs font-semibold uppercase tracking-wide ${
                                          followUp.status === "completed"
                                            ? "text-emerald-600"
                                            : isOverdue
                                              ? "text-red-500"
                                              : "text-amber-600"
                                        }`}
                                      >
                                        {followUp.status === "completed"
                                          ? "Completed"
                                          : isOverdue
                                            ? "Overdue"
                                            : "Pending"}
                                      </p>
                                    </div>

                                    <span className="shrink-0 text-xs text-slate-400">
                                      {dueDate.toLocaleString()}
                                    </span>
                                  </div>

                                  {followUp.description && (
                                    <p className="mt-2 text-sm leading-6 text-slate-600">
                                      {followUp.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full min-h-[500px] items-center justify-center">
                    <div className="max-w-sm text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-xl shadow-sm ring-1 ring-slate-200">
                        ◇
                      </div>

                      <h3 className="mt-4 font-bold text-slate-950">
                        Select a lead
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Select a lead from the list to see the information Kuba has captured.
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {briefing && (
                <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-5">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
                      Kuba Sales Intelligence
                    </p>

                    <h2 className="mt-2 text-xl font-black text-slate-950">
                      {briefing.greeting}
                    </h2>

                    <p className="mt-2 text-sm text-slate-500">
                      {briefing.recommendation}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Total Leads
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-950">
                        {briefing.summary?.totalLeads ?? 0}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Qualified
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-950">
                        {briefing.summary?.qualifiedLeads ?? 0}
                      </p>
                    </div>

                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-xs text-slate-400">
                        Follow-ups
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-950">
                        {briefing.summary?.pendingFollowUps ?? 0}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-4">
                      <p className="text-xs text-red-400">
                        Overdue
                      </p>
                      <p className="mt-1 text-2xl font-black text-red-600">
                        {briefing.summary?.overdueFollowUps ?? 0}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <section className="flex min-h-[600px] flex-col bg-white">
                <div className="border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 font-bold text-white">
                      K
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-950">
                        Kuba Sales
                      </h3>

                      <p className="text-xs text-slate-500">
                        AI sales assistant
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">

                  {memoryLoading && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-400">
                      Loading Kuba Sales memory...
                    </div>
                  )}

                  {messages.map(
                    (item, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          item.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-6 ${
                            item.role === "user"
                              ? "bg-slate-950 text-white"
                              : "border border-slate-200 bg-slate-50 text-slate-700"
                          }`}
                        >
                          {item.content}
                        </div>
                      </div>
                    ),
                  )}

                  {loading && (
                    <div className="flex justify-start">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                        Kuba Sales is thinking...
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 p-4">
                  <form
                    onSubmit={handleSubmit}
                    className="flex gap-2"
                  >
                    <input
                      value={message}
                      onChange={(event) =>
                        setMessage(
                          event.target.value,
                        )
                      }
                      placeholder="Ask Kuba Sales..."
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
                    />

                    <button
                      type="submit"
                      disabled={
                        loading ||
                        !message.trim()
                      }
                      className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? "..." : "Send"}
                    </button>
                  </form>
                </div>
              </section>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
