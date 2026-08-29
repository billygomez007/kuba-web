"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActivateEmployeeButton from "../components/ActivateEmployeeButton";
import KubaExecutiveChat from "../components/command-center/KubaExecutiveChat";
import BusinessHealthCards from "../components/command-center/BusinessHealthCards";
import DepartmentIntelligence from "../components/command-center/DepartmentIntelligence";
import ExecutiveAlerts from "../components/command-center/ExecutiveAlerts";
import ExecutiveBriefing from "../components/command-center/ExecutiveBriefing";
import ExecutiveActions from "../components/command-center/ExecutiveActions";
import ExecutiveAIHub from "../components/command-center/ExecutiveAIHub";
import RecentConversations from "../components/command-center/RecentConversations";
import LoadingState from "../components/ui/LoadingState";
import ErrorState from "../components/ui/ErrorState";
import BusinessGreeting from "../components/business/BusinessGreeting";
import ExecutiveIntelligencePanels from "../components/command-center/ExecutiveIntelligencePanels";
import ExecutiveOperationsOverview from "../components/command-center/ExecutiveOperationsOverview";
import AIWorkforceOverview from "../components/dashboard/AIWorkforceOverview";
import SetupChecklist from "../components/dashboard/SetupChecklist";

type Business = {
  id: string;
  name: string;
  industry: string;
  country: string;
  businessSize: string;
  logoUrl: string | null;
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
  const [businessTimezone, setBusinessTimezone] = useState<string | null>(null);
  const [userTimezone, setUserTimezone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const response = await fetch("/api/businesses", {
          cache: "no-store",
        });

        if (response.status === 404) {
          const data = await response.json();

          if (data?.onboardingStatus === "new_user") {
            setBusiness(null);
            setEmployees([]);
            setBusinessTimezone(null);
            setUserTimezone(null);
            setLoadFailed(false);
            return;
          }
        }

        if (!response.ok) {
          throw new Error("Unable to load business.");
        }

        const data = await response.json();

        setBusiness(data.business ?? data);
        setEmployees(data.employees ?? []);
        setBusinessTimezone(data.profile?.timezone ?? null);
        setUserTimezone(data.userTimezone ?? null);
        setLoadFailed(false);
      } catch (error) {
        console.error(error);
        setLoadFailed(true);
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

  if (loading) {
    return <LoadingState variant="page" message="Getting your workspace ready..." />;
  }

  if (loadFailed) {
    return (
      <ErrorState
        variant="page"
        title="Your workspace needs a moment."
        message="Your AI workforce is still protected. Please try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <main className="min-h-screen bg-surface-page text-white">
      {/* Background Gradient Effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-cyan-500/[0.07] blur-[160px]" />
        <div className="absolute right-[-200px] top-[20%] h-[600px] w-[600px] rounded-full bg-violet-600/[0.07] blur-[160px]" />
        <div className="absolute bottom-[-200px] left-[50%] h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-cyan-500/[0.04] blur-[140px]" />
      </div>

      <div className="relative">
        <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10 lg:py-14">

          {/* Premium Dashboard Header */}
          <section className="mb-10">
            <div className="flex flex-col justify-between gap-5 sm:gap-7 lg:flex-row lg:items-end">
              <BusinessGreeting
                name={business?.name || "Your business"}
                logoUrl={business?.logoUrl}
                industry={business?.industry}
                activeEmployeeCount={activeCount}
                businessTimezone={businessTimezone}
                userTimezone={userTimezone}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Link
                  href="/dashboard/ai-employees"
                  className="rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-white/70 transition hover:bg-white/[0.08] hover:text-white text-center"
                >
                  View Workforce
                </Link>
                <Link
                  href="/dashboard/business-brain"
                  className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] px-4 py-2.5 text-center text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/[0.1] sm:rounded-xl sm:px-5 sm:py-3 sm:text-sm"
                >
                  Open Business Brain
                </Link>
                <Link
                  href="#workforce"
                  className="inline-flex items-center justify-center rounded-lg sm:rounded-xl bg-white px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
                >
                  + Add AI Employee
                </Link>
              </div>
            </div>
          </section>

          {/* Operations Overview */}
          <ExecutiveOperationsOverview initialEmployees={employees} />

          <div className="mt-6">
            <AIWorkforceOverview />
          </div>

          <SetupChecklist />

          {/* CEO COMMAND CENTER */}
          <section className="mt-12 space-y-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
                Executive Intelligence
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                Business Command Center
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                Real-time insights into your business operations, AI workforce activity, and key performance metrics.
              </p>
            </div>

            <BusinessHealthCards />

            <ExecutiveIntelligencePanels />

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


          {/* AI Workforce Section */}
          <section id="workforce" className="mt-14">
            <div className="flex flex-col justify-between gap-4 sm:gap-6 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/70">
                  Workforce Management
                </p>

                <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
                  Your AI Workforce
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">
                  Activate, manage, and monitor your AI employees across sales, operations, 
                  customer service, finance, and more. Each AI employee is a specialized team member 
                  ready to help your business scale.
                </p>
              </div>

              <Link
                href="/dashboard/ai-employees"
                className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                View All Employees
              </Link>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                        className="mt-6 flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-400/[0.08] px-4 py-3 transition hover:bg-emerald-400/[0.12]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
                          <span className="text-sm font-bold text-emerald-300">
                            Active & Working
                          </span>
                        </div>

                        <span className="text-xs font-medium text-emerald-300/70">
                          View →
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

          {/* Business Workspace Overview */}
          <section className="mt-14 grid gap-6 lg:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/[0.12] to-cyan-500/[0.04] p-6 lg:col-span-1">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/70">
                Organization
              </p>

              <h2 className="mt-3 text-2xl font-black">
                Workspace
              </h2>

              <div className="mt-6 space-y-5">
                <BusinessDetail
                  label="Business Status"
                  value={business?.status || "Active"}
                />

                <BusinessDetail
                  label="Industry"
                  value={business?.industry || "Not specified"}
                />

                <BusinessDetail
                  label="Location"
                  value={business?.country || "Ghana"}
                />

                <BusinessDetail
                  label="Organization Size"
                  value={business?.businessSize || "Not specified"}
                />
              </div>

              <Link
                href="/dashboard/settings"
                className="mt-6 block w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm font-semibold text-white/60 transition hover:bg-white/[0.08] hover:text-white"
              >
                Update Settings
              </Link>
            </div>
          </section>

          {/* Premium CTA Section */}
          <section className="relative mt-16 overflow-hidden rounded-2xl sm:rounded-[32px] border border-white/10 bg-white/[0.025] p-6 sm:p-10 lg:p-12">
            <div className="pointer-events-none absolute right-[-100px] top-[-120px] h-[400px] w-[400px] rounded-full bg-violet-600/15 blur-[110px]" />
            <div className="pointer-events-none absolute bottom-[-150px] left-[-100px] h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[100px]" />

            <div className="relative max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/70">
                Scale Your Business
              </p>

              <h2 className="mt-4 text-2xl font-black tracking-[-0.03em] sm:text-3xl lg:text-4xl">
                Start with one AI employee.
                <br className="hidden sm:block" />
                <span className="text-white/25">
                  Build an entire workforce.
                </span>
              </h2>

              <p className="mt-4 sm:mt-6 max-w-2xl text-sm sm:text-base leading-6 sm:leading-7 text-white/40">
                {`SuperKuba's AI workforce adapts to your business. Start with the roles that drive`}
                <br /> 
                {`the most value, then expand as your Kuba team learns your operations and scales`}
                <br />
                {`with your growth. From sales to operations to customer service—build your perfect team.`}
              </p>

              <div className="mt-6 sm:mt-8 flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Link
                  href="#workforce"
                  className="rounded-lg sm:rounded-xl bg-white px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-black text-center transition hover:bg-white/90"
                >
                  Browse AI Employees
                </Link>

                <Link
                  href="#workforce"
                  className="rounded-lg sm:rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-bold text-white text-center transition hover:bg-white/[0.08]"
                >
                  Create AI Employee
                </Link>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="mt-12 sm:mt-16 border-t border-white/[0.06] py-8 sm:py-10">
            <div className="flex flex-col gap-3 sm:gap-4 text-xs sm:text-sm text-white/25 sm:flex-row sm:items-center sm:justify-between">
              <span className="font-medium">
                SuperKuba AI · Your Business, Powered by an AI Workforce.
              </span>

              <span>
                {business?.name || "Your business"}
              </span>
            </div>
            <nav className="mt-6 flex flex-wrap gap-4 sm:gap-6 text-xs text-white/30" aria-label="Dashboard trust links">
              <Link href="/help" className="transition hover:text-white/60">Help Center</Link>
              <Link href="/security" className="transition hover:text-white/60">Security</Link>
              <Link href="/privacy" className="transition hover:text-white/60">Privacy</Link>
              <Link href="/dashboard/settings" className="transition hover:text-white/60">Settings</Link>
            </nav>
          </footer>
        </div>
      </div>
    </main>
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
    <div className="group rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition duration-300 hover:-translate-y-2 hover:border-violet-400/30 hover:bg-white/[0.035] hover:shadow-xl hover:shadow-violet-600/10">
      <div className="flex items-start justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-xl transition group-hover:bg-violet-500/10 group-hover:text-violet-300">
          {icon}
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white/30 transition group-hover:border-violet-300/20 group-hover:bg-violet-300/[0.08] group-hover:text-violet-200">
          {category}
        </span>
      </div>

      <h3 className="mt-6 text-lg font-bold tracking-tight">{title}</h3>

      <p className="mt-3 min-h-[60px] text-sm leading-6 text-white/40">
        {description}
      </p>

      {children}
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
