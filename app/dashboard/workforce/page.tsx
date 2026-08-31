"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ActivateEmployeeButton from "../../components/ActivateEmployeeButton";
import AIEmployeeAvatar from "../../components/employees/AIEmployeeAvatar";

type Employee = {
  id: string;
  name: string;
  type: string;
  description: string | null;
  status: string;
};

type EmployeeDefinition = {
  templateId: string;
  type: string;
  name: string;
  category: string;
  description: string;
  icon: string;
};

const employeeLibrary: EmployeeDefinition[] = [
  {
    name: "Kuba General Manager",
    type: "general-manager",
    category: "Executive",
    description:
      "Oversees business operations, coordinates AI employees, monitors performance, identifies bottlenecks, and helps business owners make better decisions.",
    icon: "◈",
    templateId: "general-manager",
  },

  {
    templateId: "kuba-sales",
    type: "sales",
    name: "Kuba Sales",
    category: "Revenue",
    icon: "↗",
    description:
      "Find prospects, qualify leads, follow up with customers, and help move opportunities toward revenue.",
  },
  {
    templateId: "kuba-receptionist",
    type: "receptionist",
    name: "Kuba Receptionist",
    category: "Customer Operations",
    icon: "✦",
    description:
      "Welcome customers, answer questions, capture information, and route customer requests.",
  },
  {
    templateId: "kuba-accountant",
    type: "accountant",
    name: "Kuba Accountant",
    category: "Finance",
    icon: "◎",
    description:
      "Support bookkeeping, financial records, reporting, and accounting workflows.",
  },
  {
    templateId: "kuba-appointment",
    type: "appointment",
    name: "Kuba Appointment",
    category: "Operations",
    icon: "◈",
    description:
      "Schedule appointments, manage availability, send reminders, and handle bookings.",
  },
  {
    templateId: "kuba-marketing",
    type: "marketing",
    name: "Kuba Marketing",
    category: "Marketing",
    icon: "✺",
    description:
      "Plan campaigns, create content, engage customers, and support marketing workflows.",
  },
  {
    templateId: "kuba-outreach",
    type: "outreach",
    name: "Kuba Outreach",
    category: "Revenue",
    icon: "⌁",
    description:
      "Find and research prospects, identify buying signals, prepare personalized outreach, and hand qualified opportunities to Sales.",
  },
  {
    templateId: "kuba-customer-support",
    type: "customer-support",
    name: "Kuba Customer Support",
    category: "Customer Experience",
    icon: "◌",
    description:
      "Handle customer questions, resolve common issues, and support customers across their journey.",
  },
  {
    templateId: "kuba-hr",
    type: "hr",
    name: "Kuba HR",
    category: "People",
    icon: "◉",
    description:
      "Support recruitment, employee information, HR workflows, and people operations.",
  },
  {
    templateId: "kuba-operations",
    type: "operations",
    name: "Kuba Operations",
    category: "Operations",
    icon: "⌁",
    description:
      "Coordinate business processes, monitor operational workflows, and help keep work moving.",
  },
  {
    templateId: "kuba-finance",
    type: "finance",
    name: "Kuba Finance",
    category: "Finance",
    icon: "◍",
    description:
      "Support financial planning, analysis, budgets, and business finance workflows.",
  },
];

export default function WorkforcePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  type ActivityItem = {
    id: string;
    type: string;
    title?: string;
    description?: string;
    message?: string;
  };

  const [activities, setActivities] =
    useState<ActivityItem[]>([]);

  async function loadEmployees() {
    try {
      const response = await fetch("/api/businesses", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load workforce.");
      }

      const data = await response.json();
      setEmployees(data.employees ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEmployees();

      void fetch("/api/ai/activities")
        .then((r) => r.json())
        .then((data) => {
          setActivities(data.activities || []);
        });
    }, 0);

    return () => window.clearTimeout(timer);

  }, []);

  const activeTypes = useMemo(
    () => new Set(employees.map((employee) => employee.type)),
    [employees],
  );

  const activeEmployees = useMemo(
    () =>
      employees.filter(
        (employee) => employee.status.toLowerCase() === "active",
      ),
    [employees],
  );


  const availableEmployees = useMemo(
    () =>
      employeeLibrary.filter(
        (employee) =>
          !activeTypes.has(employee.type),
      ),
    [activeTypes],
  );

  const filteredLibrary = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return employeeLibrary;
    }

    return employeeLibrary.filter(
      (employee) =>
        employee.name.toLowerCase().includes(query) ||
        employee.category.toLowerCase().includes(query) ||
        employee.description.toLowerCase().includes(query),
    );
  }, [search]);

  return (
    <main className="min-h-screen bg-[#050507] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-cyan-500/[0.06] blur-[150px]" />
        <div className="absolute right-[-150px] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/[0.06] blur-[150px]" />
      </div>

      <div className="relative mx-auto max-w-[1500px] px-6 py-10 lg:px-10 lg:py-14">

        {/* Header */}
        <section className="flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
              AI Workforce
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              Build your AI workforce.
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-7 text-white/40">
              Give your business intelligent employees that can help with
              sales, customer service, finance, marketing, operations, and
              more.
            </p>
          </div>

          <Link
            href="/dashboard/ai-employees/create"
            className="shrink-0 rounded-xl bg-white px-5 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90"
          >
            + Create AI employee
          </Link>
        </section>

        {/* Executive Team + Priorities */}
        <section className="mt-10">

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">

            {/* Executive Team */}
            <div className="rounded-3xl border border-violet-400/15 bg-gradient-to-br from-violet-500/[0.07] via-white/[0.025] to-cyan-400/[0.04] p-6">

              <div className="mb-5 flex items-center justify-between">

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/60">
                    Executive team
                  </p>

                  <p className="mt-1 text-sm text-white/30">
                    Business leadership
                  </p>
                </div>

                <span className="rounded-full border border-violet-400/15 bg-violet-400/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  Leadership
                </span>

              </div>

              {loading ? (

                <div className="rounded-2xl border border-white/10 bg-black/10 p-6 text-center">
                  <p className="text-sm text-white/30">
                    Loading executive team...
                  </p>
                </div>

              ) : (

                (() => {

                  const generalManager =
                    activeEmployees.find(
                      (employee) =>
                        employee.type === "general-manager",
                    );

                  if (!generalManager) {

                    const generalManagerDefinition =
                      employeeLibrary.find(
                        (item) =>
                          item.type === "general-manager",
                      );

                    if (!generalManagerDefinition) {
                      return (
                        <p className="text-sm text-red-300">
                          General Manager is not configured.
                        </p>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                        <div className="flex items-center gap-4">

                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-violet-400/20 bg-black/20">

                            <img
                              src="/brand/kuba-general-manager-avatar.png"
                              alt="Kuba General Manager"
                              className="h-full w-full object-cover"
                            />

                          </div>

                          <div>

                            <div className="flex flex-wrap items-center gap-2">

                              <h3 className="text-xl font-black">
                                Kuba General Manager
                              </h3>

                              <span className="rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">
                                Executive
                              </span>

                            </div>

                            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-300/60">
                              Business Oversight • Workforce Coordination
                            </p>

                            <p className="mt-2 max-w-xl text-sm leading-5 text-white/35">
                              Oversees business operations and coordinates
                              the AI workforce.
                            </p>

                          </div>

                        </div>

                        <ActivateEmployeeButton
                          name={generalManagerDefinition.name}
                          type={generalManagerDefinition.type}
                          description={generalManagerDefinition.description}
                          templateId={generalManagerDefinition.templateId}
                        />

                      </div>
                    );
                  }

                  const definition =
                    employeeLibrary.find(
                      (item) =>
                        item.type === generalManager.type,
                    );

                  return (
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                      <div className="flex items-center gap-4">

                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-violet-400/20 bg-black/20">

                          <img
                            src="/brand/kuba-general-manager-avatar.png"
                            alt={generalManager.name}
                            className="h-full w-full object-cover"
                          />

                          <span className="absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-[#15121c] bg-emerald-400" />

                        </div>

                        <div>

                          <div className="flex flex-wrap items-center gap-2">

                            <h3 className="text-xl font-black">
                              {generalManager.name}
                            </h3>

                            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
                              Online
                            </span>

                          </div>

                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-300/60">
                            Business Oversight • Workforce Coordination
                          </p>

                          <p className="mt-2 max-w-xl text-sm leading-5 text-white/35">
                            Oversees the business, coordinates the AI workforce,
                            and helps management identify what matters most.
                          </p>

                        </div>

                      </div>

                      <Link
                        href={`/dashboard/employees/${generalManager.id}`}
                        className="shrink-0 rounded-xl bg-white px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-white/90"
                      >
                        Open Workspace →
                      </Link>

                    </div>
                  );

                })()

              )}

            </div>


            {/* Executive Priorities */}
            <div className="rounded-3xl border border-amber-400/10 bg-amber-400/[0.025] p-6">

              <div className="flex items-start justify-between">

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300/60">
                    Executive priorities
                  </p>

                  <h3 className="mt-2 text-xl font-black">
                    What needs attention
                  </h3>
                </div>

                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/[0.08] text-amber-300">
                  !
                </div>

              </div>

              <div className="mt-5 space-y-3">

                {activities.length > 0 ? (

                  activities
                    .slice(0, 3)
                    .map((activity) => (

                      <div
                        key={activity.id}
                        className="rounded-2xl border border-white/10 bg-black/20 p-3.5"
                      >

                        <p className="text-sm font-semibold">
                          {activity.title}
                        </p>

                        {activity.description && (
                          <p className="mt-1 text-xs leading-5 text-white/35">
                            {activity.description}
                          </p>
                        )}

                      </div>

                    ))

                ) : (

                  <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.025] p-4">

                    <p className="text-sm font-semibold text-emerald-300">
                      No immediate priorities detected.
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/30">
                      Your workforce has no recent management activity
                      requiring attention.
                    </p>

                  </div>

                )}

              </div>

            </div>

          </div>

        </section>


        {/* Workforce + Activity */}
        <section className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">

          {/* Active Workforce */}
          <div>

            <div className="mb-5">

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/60">
                Your team
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Your AI Workforce
              </h2>

              <p className="mt-2 text-sm text-white/35">
                Your specialized AI employees working across your business.
              </p>

            </div>

            {loading ? (

              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-10 text-center">
                <p className="text-sm text-white/30">
                  Loading your AI workforce...
                </p>
              </div>

            ) : activeEmployees.filter(
                (employee) => employee.type !== "general-manager",
              ).length === 0 ? (

              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xl">
                  ✦
                </div>

                <h3 className="mt-5 text-lg font-bold">
                  Your workforce is waiting.
                </h3>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/35">
                  Activate your first specialized AI employee below and
                  start building your digital workforce.
                </p>

              </div>

            ) : (

              <div className="grid gap-4 sm:grid-cols-2">

                {activeEmployees
                  .filter(
                    (employee) => employee.type !== "general-manager",
                  )
                  .map((employee) => {

                    const definition =
                      employeeLibrary.find(
                        (item) => item.type === employee.type,
                      );

                    return (
                      <ActiveEmployeeCard
                        key={employee.id}
                        employee={employee}
                        definition={definition}
                      />
                    );

                  })}

              </div>

            )}

          </div>


          {/* Recent Activity */}
          <aside>

            <div className="mb-5">

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
                Live feed
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Recent Activity
              </h2>

              <p className="mt-2 text-sm text-white/35">
                See what your AI workforce is doing.
              </p>

            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">

              <div className="space-y-3">

                {activities.slice(0, 8).map(
                  (activity) => (

                    <div
                      key={activity.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >

                      <div className="flex items-start gap-3">

                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-400/[0.08] text-sm">
                          🧠
                        </div>

                        <div className="min-w-0">

                          <p className="text-sm font-semibold">
                            {activity.title}
                          </p>

                          {activity.description && (
                            <p className="mt-1 text-xs leading-5 text-white/35">
                              {activity.description}
                            </p>
                          )}

                          <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-white/20">
                            {activity.type}
                          </p>

                        </div>

                      </div>

                    </div>

                  ),
                )}

                {activities.length === 0 && (

                  <div className="py-8 text-center">

                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      🧠
                    </div>

                    <p className="mt-4 text-sm font-semibold">
                      No AI activity yet
                    </p>

                    <p className="mt-1 text-xs leading-5 text-white/25">
                      Activity will appear here as your AI employees work.
                    </p>

                  </div>

                )}

              </div>

            </div>

          </aside>

        </section>


        {/* Employee Library */}
        <section className="mt-14" id="employee-library">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/30">
                Employee library
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Available AI employees
              </h2>

              <p className="mt-2 text-sm text-white/35">
                Activate new AI employees for your business.
              </p>
            </div>

            <div className="w-full lg:w-80">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search AI employees..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-400/40 focus:ring-2 focus:ring-cyan-400/10"
              />
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {availableEmployees
              .filter((employee) =>
                employee.name
                  .toLowerCase()
                  .includes(search.toLowerCase())
                ||
                employee.category
                  .toLowerCase()
                  .includes(search.toLowerCase())
              )
              .map((employee) => (

                <EmployeeLibraryCard
                  key={employee.type}
                  employee={employee}
                  active={false}
                />

              ))}
          </div>

          {filteredLibrary.length === 0 && (
            <div className="mt-6 rounded-3xl border border-dashed border-white/10 p-10 text-center">
              <p className="text-sm text-white/35">
                No AI employees match your search.
              </p>
            </div>
          )}
        </section>


        {/* Stats */}
        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <WorkforceStat
            label="Active employees"
            value={String(activeEmployees.length)}
            description="AI employees working for your business"
          />

          <WorkforceStat
            label="Available roles"
            value={String(
              Math.max(employeeLibrary.length - activeTypes.size, 0),
            )}
            description="Roles ready to activate"
          />

          <WorkforceStat
            label="Workforce capacity"
            value={`${activeEmployees.length}/${employeeLibrary.length}`}
            description="Current employees in your library"
          />
        </section>



        {/* Future workforce */}
        <section className="relative mt-14 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.025] p-8 sm:p-10">
          <div className="pointer-events-none absolute right-[-120px] top-[-150px] h-[450px] w-[450px] rounded-full bg-violet-600/10 blur-[120px]" />
          <div className="pointer-events-none absolute bottom-[-150px] left-[-100px] h-[350px] w-[350px] rounded-full bg-cyan-500/10 blur-[110px]" />

          <div className="relative max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-400">
              The future of work
            </p>

            <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              One employee is just the beginning.
            </h2>

            <p className="mt-5 text-sm leading-7 text-white/40">
              Kuba is designed to let businesses build an entire AI workforce
              around the way they operate. Start small, then add the employees
              you need as your business grows.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              {[
                "Sales",
                "Customer Support",
                "Finance",
                "Marketing",
                "HR",
                "Operations",
              ].map((role) => (
                <span
                  key={role}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/40"
                >
                  {role}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function WorkforceStat({
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

function getEmployeeAvatar(type: string) {
  const avatars: Record<string, string> = {
    receptionist: "/avatars/receptionist.png",
    sales: "/avatars/sales.png",
    "customer-support": "/avatars/customer-support.png",
    accountant: "/avatars/accountant.png",
    finance: "/avatars/finance.png",
    marketing: "/avatars/marketing.png",
    hr: "/avatars/hr.png",
    operations: "/avatars/operations.png",
    appointment: "/avatars/appointment.png",
    "general-manager": "/brand/kuba-general-manager-avatar.png",
  };

  return avatars[type] || "/avatars/receptionist.png";
}


function ActiveEmployeeCard({
  employee,
  definition,
  executive = false,
}: {
  employee: Employee;
  definition?: EmployeeDefinition;
  executive?: boolean;
}) {
  const avatar = getEmployeeAvatar(employee.type);

  return (
    <div
      className={`relative overflow-hidden rounded-3xl border transition ${
        executive
          ? "border-violet-400/20 bg-gradient-to-br from-violet-500/[0.07] via-white/[0.025] to-cyan-400/[0.04] hover:border-violet-400/35"
          : "border-white/10 bg-white/[0.025] hover:border-cyan-400/25 hover:bg-white/[0.04]"
      }`}
    >

      {executive && (
        <>
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
        </>
      )}

      <div className="relative p-5">

        <div className="flex items-start justify-between gap-4">

          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/20">

            <img
              src={avatar}
              alt={employee.name}
              className="h-full w-full object-cover"
            />

            <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-[#111116] bg-emerald-400" />

          </div>

          <div className="flex flex-wrap justify-end gap-2">

            {executive && (
              <span className="rounded-full border border-violet-400/20 bg-violet-400/[0.08] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-violet-300">
                Executive
              </span>
            )}

            <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-300">
              Online
            </span>

          </div>

        </div>

        <div className="mt-5">

          <h3
            className={
              executive
                ? "text-xl font-black tracking-tight"
                : "text-lg font-bold"
            }
          >
            {employee.name}
          </h3>

          <p
            className={`mt-1.5 text-[10px] font-bold uppercase tracking-[0.16em] ${
              executive
                ? "text-violet-300/70"
                : "text-cyan-300/60"
            }`}
          >
            {executive
              ? "Business Oversight • Workforce Coordination"
              : definition?.category || employee.type}
          </p>

        </div>

        <div
          className={`mt-5 rounded-2xl border p-4 ${
            executive
              ? "border-violet-400/10 bg-violet-400/[0.035]"
              : "border-white/10 bg-white/[0.025]"
          }`}
        >

          <p
            className={`text-[9px] font-bold uppercase tracking-[0.18em] ${
              executive
                ? "text-violet-300/60"
                : "text-white/25"
            }`}
          >
            Specializes in
          </p>

          <p className="mt-2 min-h-[48px] text-sm leading-5 text-white/45">
            {executive
              ? "Business oversight, workforce coordination, priorities, risk identification, and executive decision support."
              : employee.description ||
                definition?.description ||
                "Your AI employee is ready to work."}
          </p>

        </div>

        <Link
          href={`/dashboard/employees/${employee.id}`}
          className={`mt-4 flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-semibold transition ${
            executive
              ? "border-violet-400/15 bg-violet-400/[0.06] text-violet-200 hover:border-violet-400/30 hover:bg-violet-400/[0.1]"
              : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          <span>
            {executive
              ? "Open Executive Workspace"
              : "Open employee"}
          </span>

          <span>→</span>
        </Link>

      </div>
    </div>
  );
}

function EmployeeLibraryCard({
  employee,
  active,
}: {
  employee: EmployeeDefinition;
  active: boolean;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-cyan-400/25 hover:bg-white/[0.04]">

      {/* Role */}
      <div className="flex items-start justify-between gap-3">

        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/40">
          {employee.category}
        </span>

        <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-white/25">
          AI Employee
        </span>

      </div>


      {/* Avatar */}
      <div className="mt-5 flex justify-center">

        <AIEmployeeAvatar
          type={employee.type}
          name={employee.name}
          size="md"
          showStatus={false}
        />

      </div>


      {/* Identity */}
      <h3 className="mt-5 text-center text-lg font-bold">
        {employee.name}
      </h3>

      <p className="mt-1.5 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300/60">
        {employee.category}
      </p>


      {/* Specialization */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4">

        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/25">
          Specializes in
        </p>

        <p className="mt-2 min-h-[48px] text-sm leading-5 text-white/45">
          {employee.description}
        </p>

      </div>


      {/* Activation */}
      {active ? (

        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] px-4 py-3 text-sm font-semibold text-emerald-300">

          <span className="h-2 w-2 rounded-full bg-emerald-400" />

          Already active

        </div>

      ) : (

        <ActivateEmployeeButton
          name={employee.name}
          type={employee.type}
          description={employee.description}
          templateId={employee.templateId}
        />

      )}

    </div>
  );
}

