"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import ActivateEmployeeButton from "../components/ActivateEmployeeButton";
import SalesEmployeeChat from "../components/SalesEmployeeChat";
import KubaAssistantPanel from "../components/command-center/KubaAssistantPanel";
import KubaExecutiveChat from "../components/command-center/KubaExecutiveChat";
import BusinessHealthCards from "../components/command-center/BusinessHealthCards";
import DepartmentIntelligence from "../components/command-center/DepartmentIntelligence";
import ExecutiveAlerts from "../components/command-center/ExecutiveAlerts";
import ExecutiveBriefing from "../components/command-center/ExecutiveBriefing";
import ExecutiveActions from "../components/command-center/ExecutiveActions";
import ExecutiveAIHub from "../components/command-center/ExecutiveAIHub";
import RecentConversations from "../components/command-center/RecentConversations";

type Business = {
  id: string;
  name: string;
  industry: string;
  country: string;
  businessSize: string;
  status: string;
};

type Employee = {
  id: string;
  name: string;
  type: string;
  status: string;
};

const employeeLibrary = [
  {
    type: "sales",
    icon: "↗",
    title: "Kuba Sales",
    description:
      "Find prospects, qualify leads, follow up with customers, and help move opportunities toward revenue.",
    category: "Revenue",
  },
  {
    type: "receptionist",
    icon: "✦",
    title: "Kuba Receptionist",
    description:
      "Welcome customers, answer common questions, capture information, and route requests.",
    category: "Customer Operations",
  },
  {
    type: "accountant",
    icon: "◎",
    title: "Kuba Accountant",
    description:
      "Help manage bookkeeping, financial records, reports, and accounting workflows.",
    category: "Finance",
  },
  {
    type: "appointment",
    icon: "◈",
    title: "Kuba Appointment",
    description:
      "Schedule appointments, manage availability, send reminders, and handle bookings.",
    category: "Operations",
  },
  {
    type: "marketing",
    icon: "✺",
    title: "Kuba Marketing",
    description:
      "Plan campaigns, create content, engage customers, and support marketing workflows.",
    category: "Marketing",
  },
];

export default function DashboardPage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/businesses", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load business.");
        }

        const data = await response.json();

        setBusiness(data.business ?? data);
        setEmployees(data.employees ?? []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const activeEmployeeTypes = useMemo(
    () => new Set(employees.map((employee) => employee.type)),
    [employees],
  );

  const activeEmployeeMap = useMemo(
    () => new Map(employees.map((employee) => [employee.type, employee])),
    [employees],
  );

  const activeCount = employees.length;
  const availableCount = Math.max(employeeLibrary.length - activeCount, 0);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] text-white">
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="relative mx-auto flex h-28 w-72 items-center justify-center">
              <div className="absolute inset-0 animate-pulse rounded-[2rem] bg-cyan-400/10 blur-2xl" />
              <Image
                src="/brand/superkuba-logo.png"
                alt="SuperKuba"
                width={2131}
                height={738}
                priority
                className="relative h-auto w-64 object-contain drop-shadow-[0_0_28px_rgba(0,200,255,0.22)]"
              />
            </div>

            <p className="mt-6 text-sm font-medium tracking-wide text-white/50">
              Loading your SuperKuba workspace...
            </p>

            <div className="mx-auto mt-3 h-1 w-24 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-cyan-500/[0.07] blur-[160px]" />
        <div className="absolute right-[-200px] top-[20%] h-[600px] w-[600px] rounded-full bg-violet-600/[0.07] blur-[160px]" />
      </div>

      <div className="relative">


        <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10 lg:py-14">

          {/* Hero */}
          <section>
            <div className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
                  Kuba Business Command Center
                </p>

                <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                  {business?.name
                    ? `Welcome to ${business.name}.`
                    : "Welcome to your Kuba workspace."}
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-7 text-white/40">
                  Your AI operating system for running your business.
                  Monitor performance, understand every department, and
                  work with intelligent AI employees that help your company grow.
                </p>
              </div>

              <Link
                href="#workforce"
                className="inline-flex shrink-0 items-center justify-center rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
              >
                + Add AI employee
              </Link>
            </div>
          </section>

          {/* CEO COMMAND CENTER */}

          <section className="mt-10 space-y-8">

            <BusinessHealthCards />

            <div className="grid gap-6 xl:grid-cols-2">

              <ExecutiveBriefing />

              <KubaExecutiveChat />

            </div>

            <ExecutiveAlerts />

            <ExecutiveActions />

            <ExecutiveAIHub />

            <RecentConversations />

            <DepartmentIntelligence />

          </section>


          {/* Stats */}
          <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="AI employees"
              value={String(activeCount)}
              description="Currently activated"
              icon="✦"
              accent="violet"
            />

            <StatCard
              label="Available employees"
              value={String(availableCount)}
              description="Ready to activate"
              icon="＋"
              accent="cyan"
            />

            <StatCard
              label="Customers"
              value="0"
              description="Ready for your first customer"
              icon="◎"
              accent="fuchsia"
            />

            <StatCard
              label="Automations"
              value="0"
              description="Workflows currently running"
              icon="⌁"
              accent="emerald"
            />
          </section>

          {/* Workforce */}
          <section id="workforce" className="mt-14">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
                  Your workforce
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-tight">
                  Your AI Workforce
                </h2>

                <p className="mt-2 text-sm text-white/35">
                  Activate, manage, and monitor your AI employees that
                  support different areas of your business.
                </p>
              </div>

              <button
                type="button"
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                Explore library
              </button>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {employeeLibrary.map((employee) => {
                const active = activeEmployeeTypes.has(employee.type);
                const activeEmployee = activeEmployeeMap.get(employee.type);

                return (
                  <EmployeeCard
                    key={employee.type}
                    icon={employee.icon}
                    title={employee.title}
                    description={employee.description}
                    category={employee.category}
                  >
                    {active && activeEmployee ? (
                      <Link
                        href={`/dashboard/employees/${activeEmployee.id}`}
                        className="mt-5 flex items-center justify-between rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-4 py-3 transition hover:bg-emerald-400/[0.1]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                          <span className="text-sm font-bold text-emerald-300">
                            Active
                          </span>
                        </div>

                        <span className="text-xs text-white/35">
                          Open employee →
                        </span>
                      </Link>
                    ) : (
                      <ActivateEmployeeButton
                        name={employee.title}
                        type={employee.type}
                        description={employee.description}
                      />
                    )}
                  </EmployeeCard>
                );
              })}
            </div>
          </section>

          {/* Activity + Business */}
          <section className="mt-14 grid gap-6 lg:grid-cols-3">

            {/* Activity */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
                    Activity
                  </p>

                  <h2 className="mt-2 text-xl font-bold">
                    Recent AI activity
                  </h2>
                </div>

                <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-400">
                  Live
                </span>
              </div>

              <div className="mt-6">
                <ActivityRow
                  icon="↗"
                  title="Kuba Sales"
                  description="Waiting for your first lead"
                  time="Now"
                />

                <ActivityRow
                  icon="◎"
                  title="Kuba Receptionist"
                  description="No customer conversations yet"
                  time="Now"
                />

                <ActivityRow
                  icon="◈"
                  title="Kuba Appointment"
                  description="No appointments scheduled"
                  time="Now"
                />

                <ActivityRow
                  icon="✺"
                  title="Kuba Marketing"
                  description="No campaigns running yet"
                  time="Now"
                />
              </div>
            </div>

            {/* Business */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/[0.12] to-cyan-500/[0.04] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
                Business overview
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Your workspace
              </h2>

              <div className="mt-7 space-y-5">
                <BusinessDetail
                  label="Business status"
                  value={business?.status || "Active"}
                />

                <BusinessDetail
                  label="Industry"
                  value={business?.industry || "Not specified"}
                />

                <BusinessDetail
                  label="Country"
                  value={business?.country || "Ghana"}
                />

                <BusinessDetail
                  label="Business size"
                  value={business?.businessSize || "Not specified"}
                />
              </div>

              <Link
                href="/dashboard/settings"
                className="mt-7 block rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                Manage business settings
              </Link>
            </div>
          </section>

          {/* Build CTA */}
          <section className="relative mt-14 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.025] p-8 sm:p-10">
            <div className="pointer-events-none absolute right-[-100px] top-[-120px] h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[110px]" />
            <div className="pointer-events-none absolute bottom-[-150px] left-[-100px] h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[100px]" />

            <div className="relative max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
                Build with Kuba
              </p>

              <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
                Start with one AI employee.
                <br />
                <span className="text-white/30">
                  Build an entire workforce.
                </span>
              </h2>

              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/40">
                Start with the roles your business needs most, then expand
                your workforce as Kuba learns how your business operates.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="#workforce"
                  className="rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-white/90"
                >
                  Explore AI employees
                </Link>

                <button
                  type="button"
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.08]"
                >
                  Create AI employee
                </button>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-14 border-t border-white/[0.06] py-8">
            <div className="flex flex-col gap-3 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
              <span>
                SuperKuba AI · Your Business, Powered by an AI Workforce.
              </span>

              <span>
                {business?.name || "Your business"}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  icon: string;
  accent: "violet" | "cyan" | "fuchsia" | "emerald";
}) {
  const accentClasses = {
    violet: "bg-violet-500/10 text-violet-300",
    cyan: "bg-cyan-500/10 text-cyan-300",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-white/20 hover:bg-white/[0.04]">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-white/40">{label}</p>

        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentClasses[accent]}`}
        >
          {icon}
        </div>
      </div>

      <p className="mt-5 text-3xl font-black">{value}</p>

      <p className="mt-1 text-xs text-white/25">{description}</p>
    </div>
  );
}

function EmployeeCard({
  icon,
  title,
  description,
  category,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  category: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-lg">
          {icon}
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/30">
          {category}
        </span>
      </div>

      <h3 className="mt-6 text-xl font-bold">{title}</h3>

      <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/40">
        {description}
      </p>

      {children}
    </div>
  );
}

function ActivityRow({
  icon,
  title,
  description,
  time,
}: {
  icon: string;
  title: string;
  description: string;
  time: string;
}) {
  return (
    <div className="flex items-center gap-4 border-t border-white/[0.06] py-4 first:border-t-0">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-sm">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>

        <p className="mt-1 truncate text-xs text-white/30">
          {description}
        </p>
      </div>

      <span className="text-[10px] font-semibold text-white/20">
        {time}
      </span>
    </div>
  );
}

function BusinessDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] pb-4 last:border-b-0">
      <span className="text-xs text-white/30">{label}</span>

      <span className="text-right text-sm font-semibold text-white/75">
        {value}
      </span>
    </div>
  );
}
