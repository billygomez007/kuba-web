"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type WorkforceEmployee = {
  id: string;
  name: string;
  type: string;
  status: string;
  description: string | null;
};

type Priority = {
  type: string;
  title: string;
  description: string;
};

type Activity = {
  id: string;
  employeeId: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
};

type Overview = {
  business: {
    name: string;
    industry: string | null;
    country: string | null;
    status: string;
  };

  executive: {
    id: string;
    name: string;
    status: string;
  } | null;

  metrics: {
    activeEmployees: number;
    specializedEmployees: number;
    totalLeads: number;
    pendingFollowUps: number;
    overdueFollowUps: number;
    completedFollowUps: number;
  };

  workforce: WorkforceEmployee[];

  priorities: Priority[];

  recentActivities: Activity[];
};

type Props = {
  employeeId: string;
  employeeName: string;
};

export default function GeneralManagerWorkspace({
  employeeId,
  employeeName,
}: Props) {
  const [message, setMessage] = useState("");

  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        `Good to see you. I'm ${employeeName}. I can help you review the business, identify priorities, and coordinate your AI workforce.`,
    },
  ]);

  const [loading, setLoading] = useState(false);

  const [overview, setOverview] =
    useState<Overview | null>(null);

  const [overviewLoading, setOverviewLoading] =
    useState(true);

  const bottomRef =
    useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  useEffect(() => {
    async function loadOverview() {
      try {
        const response = await fetch(
          "/api/ai/general-manager/overview",
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          throw new Error(
            "Unable to load executive overview.",
          );
        }

        const data = await response.json();

        setOverview(data);
      } catch (error) {
        console.error(
          "General Manager overview error:",
          error,
        );
      } finally {
        setOverviewLoading(false);
      }
    }

    loadOverview();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedMessage =
      message.trim();

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
        "/api/ai/general-manager",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: trimmedMessage,
            employeeId,
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "General Manager could not respond.",
        );
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.response,
        },
      ]);
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

  return (
    <div className="space-y-8">

      {/* Executive Overview */}
      <section>

        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/60">
            Business intelligence
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Executive Overview
          </h2>

          <p className="mt-2 text-sm text-white/35">
            A live view of your business and AI workforce.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <ExecutiveMetric
            label="AI Workforce"
            value={
              overviewLoading
                ? "..."
                : String(
                    overview?.metrics
                      .specializedEmployees ?? 0,
                  )
            }
            description="Specialized employees"
          />

          <ExecutiveMetric
            label="Leads"
            value={
              overviewLoading
                ? "..."
                : String(
                    overview?.metrics
                      .totalLeads ?? 0,
                  )
            }
            description="Sales opportunities"
          />

          <ExecutiveMetric
            label="Follow-ups"
            value={
              overviewLoading
                ? "..."
                : String(
                    overview?.metrics
                      .pendingFollowUps ?? 0,
                  )
            }
            description="Currently pending"
          />

          <ExecutiveMetric
            label="Attention"
            value={
              overviewLoading
                ? "..."
                : String(
                    overview?.metrics
                      .overdueFollowUps ?? 0,
                  )
            }
            description="Overdue follow-ups"
            alert={
              (overview?.metrics
                .overdueFollowUps ?? 0) > 0
            }
          />

        </div>

      </section>


      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

        {/* Executive Chat */}
        <section className="flex h-[560px] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">

          <div className="border-b border-white/10 px-6 py-5">

            <div className="flex items-center gap-3">

              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-violet-400/10 text-lg">

                <span className="absolute inset-0 animate-pulse rounded-xl bg-violet-400/10" />

                <span className="relative">
                  ◈
                </span>

              </div>

              <div>
                <h2 className="font-bold text-white">
                  Executive Command Center
                </h2>

                <p className="text-xs text-white/30">
                  {employeeName}
                </p>
              </div>

            </div>

          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-6">

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
                    className={`max-w-2xl rounded-2xl px-5 py-4 text-sm leading-6 ${
                      item.role === "user"
                        ? "bg-white text-black"
                        : "border border-white/10 bg-white/[0.04] text-white/70"
                    }`}
                  >
                    {item.content}
                  </div>
                </div>
              ),
            )}

            <div ref={bottomRef} />

            {loading && (
              <div className="flex justify-start">

                <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.04] px-5 py-4 text-sm text-white/35">
                  {employeeName} is reviewing the situation...
                </div>

              </div>
            )}

          </div>

          <div className="shrink-0 border-t border-white/10 bg-black/10 p-5">

            <form
              onSubmit={handleSubmit}
              className="flex gap-3"
            >

              <input
                value={message}
                onChange={(event) =>
                  setMessage(
                    event.target.value,
                  )
                }
                placeholder="Ask your General Manager..."
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/20 focus:border-violet-400/40"
              />

              <button
                type="submit"
                disabled={
                  loading ||
                  !message.trim()
                }
                className="rounded-xl bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loading
                  ? "Reviewing..."
                  : "Ask"}
              </button>

            </form>

          </div>

        </section>


        {/* Executive Intelligence */}
        <aside className="space-y-4">

          <div className="rounded-3xl border border-violet-400/10 bg-violet-400/[0.025] p-6">

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">
              Specializes in
            </p>

            <ul className="mt-5 space-y-3 text-sm text-white/50">
              <li>✓ Business oversight</li>
              <li>✓ AI workforce coordination</li>
              <li>✓ Priority management</li>
              <li>✓ Risk identification</li>
              <li>✓ Executive recommendations</li>
              <li>✓ Management briefings</li>
            </ul>

          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
              Executive principle
            </p>

            <p className="mt-4 text-sm leading-6 text-white/50">
              Focus on what matters most to the
              business, then coordinate the right
              people and AI employees around it.
            </p>

          </div>

          <div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.02] p-6">

            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Executive employee ready
            </div>

            <p className="mt-3 text-xs leading-5 text-white/30">
              Recommendations are advisory.
              The business owner remains the final
              decision maker.
            </p>

          </div>

        </aside>

      </div>


      {/* Workforce Coordination */}
      <section>

        <div className="mb-5">

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/60">
            Workforce coordination
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Your AI workforce
          </h2>

          <p className="mt-2 text-sm text-white/35">
            Employees currently working across the business.
          </p>

        </div>

        {overviewLoading ? (

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-8 text-center">
            <p className="text-sm text-white/30">
              Loading workforce...
            </p>
          </div>

        ) : overview?.workforce.length === 0 ? (

          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
            <p className="text-sm text-white/35">
              No specialized AI employees are currently active.
            </p>
          </div>

        ) : (

          <div className="grid gap-4 md:grid-cols-2">

            {overview?.workforce.map(
              (employee) => (
                <WorkforceEmployeeCard
                  key={employee.id}
                  employee={employee}
                />
              ),
            )}

          </div>

        )}

      </section>


      {/* Management Priorities */}
      <section>

        <div className="mb-5">

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300/60">
            Management priorities
          </p>

          <h2 className="mt-2 text-2xl font-black">
            What needs attention
          </h2>

          <p className="mt-2 text-sm text-white/35">
            Areas the General Manager should keep on the radar.
          </p>

        </div>

        {overviewLoading ? (

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-8">
            <p className="text-sm text-white/30">
              Reviewing priorities...
            </p>
          </div>

        ) : overview?.priorities.length === 0 ? (

          <div className="rounded-3xl border border-emerald-400/10 bg-emerald-400/[0.02] p-8">
            <p className="font-semibold text-emerald-300">
              No immediate priorities detected.
            </p>

            <p className="mt-2 text-sm text-white/35">
              The current business data does not show any obvious
              management issues requiring attention.
            </p>
          </div>

        ) : (

          <div className="grid gap-4 md:grid-cols-2">

            {overview?.priorities.map(
              (priority, index) => (
                <div
                  key={`${priority.type}-${index}`}
                  className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"
                >

                  <div className="flex items-center gap-3">

                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/[0.08] text-amber-300">
                      !
                    </span>

                    <h3 className="font-bold">
                      {priority.title}
                    </h3>

                  </div>

                  <p className="mt-4 text-sm leading-6 text-white/40">
                    {priority.description}
                  </p>

                </div>
              ),
            )}

          </div>

        )}

      </section>


      {/* Recent AI Activity */}
      <section>

        <div className="mb-5">

          <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/30">
            Workforce activity
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Recent AI activity
          </h2>

        </div>

        {overviewLoading ? (

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-8">
            <p className="text-sm text-white/30">
              Loading activity...
            </p>
          </div>

        ) : overview?.recentActivities.length === 0 ? (

          <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center">
            <p className="text-sm text-white/35">
              No recent AI activity yet.
            </p>
          </div>

        ) : (

          <div className="space-y-3">

            {overview?.recentActivities.map(
              (activity) => (
                <div
                  key={activity.id}
                  className="rounded-2xl border border-white/10 bg-black/20 p-4"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>

                      <p className="font-semibold">
                        {activity.title}
                      </p>

                      {activity.description && (
                        <p className="mt-1 text-sm text-white/40">
                          {activity.description}
                        </p>
                      )}

                    </div>

                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
                      {activity.type}
                    </span>

                  </div>

                </div>
              ),
            )}

          </div>

        )}

      </section>

    </div>
  );
}

function ExecutiveMetric({
  label,
  value,
  description,
  alert = false,
}: {
  label: string;
  value: string;
  description: string;
  alert?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        alert
          ? "border-amber-400/20 bg-amber-400/[0.035]"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >
      <p className="text-xs uppercase tracking-wider text-white/30">
        {label}
      </p>

      <p
        className={`mt-3 text-2xl font-black ${
          alert
            ? "text-amber-300"
            : "text-white"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-xs text-white/25">
        {description}
      </p>
    </div>
  );
}

function WorkforceEmployeeCard({
  employee,
}: {
  employee: WorkforceEmployee;
}) {
  const avatarMap: Record<string, string> = {
    receptionist: "/avatars/receptionist.png",
    sales: "/avatars/sales.png",
    "customer-support":
      "/avatars/customer-support.png",
    accountant: "/avatars/accountant.png",
    finance: "/avatars/finance.png",
    marketing: "/avatars/marketing.png",
    hr: "/avatars/hr.png",
    operations: "/avatars/operations.png",
    appointment: "/avatars/appointment.png",
  };

  const avatar =
    avatarMap[employee.type] ||
    "/avatars/receptionist.png";

  return (
    <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.025] p-5">

      <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">

        <img
          src={avatar}
          alt={employee.name}
          className="h-full w-full object-cover"
        />

      </div>

      <div className="min-w-0 flex-1">

        <div className="flex flex-wrap items-center gap-2">

          <h3 className="font-bold">
            {employee.name}
          </h3>

          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {employee.status}
          </span>

        </div>

        <p className="mt-1 text-xs uppercase tracking-wider text-white/25">
          {employee.type}
        </p>

        {employee.description && (
          <p className="mt-2 text-sm leading-5 text-white/35">
            {employee.description}
          </p>
        )}

      </div>

    </div>
  );
}
