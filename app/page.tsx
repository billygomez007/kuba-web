"use client";

import {
  Bot,
  Inbox,
  Users,
  Workflow,
  BookOpen,
  BarChart3,
  Plug,
  Settings,
  ChevronRight,
  MessageSquare,
  UserCheck,
  TrendingUp,
  MoreHorizontal,
} from "lucide-react";

const employees = [
  {
    name: "Kuba Sales",
    role: "Sales & Lead Conversion",
    status: "Working",
    conversations: 24,
    qualified: 8,
    initials: "KS",
  },
  {
    name: "Kuba Receptionist",
    role: "Customer Reception",
    status: "Working",
    conversations: 57,
    qualified: 31,
    initials: "KR",
  },
  {
    name: "Claw",
    role: "Browser & Computer Agent",
    status: "Working",
    conversations: 12,
    qualified: 0,
    initials: "CL",
  },
];

const activities = [
  "Kuba Sales qualified a new lead",
  "Kuba Receptionist handled a new enquiry",
  "New lead received from WhatsApp",
  "Kuba Sales completed a follow-up",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#f7f8fa] text-slate-900">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white lg:flex lg:flex-col">
          <div className="flex h-20 items-center px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Bot size={21} />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight">KUBA</div>
                <div className="text-xs text-slate-500">AI workforce</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 px-3 py-5">
            <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </div>

            <NavItem icon={<BarChart3 size={18} />} label="Dashboard" active />
            <NavItem icon={<Bot size={18} />} label="AI Employees" />
            <NavItem icon={<Inbox size={18} />} label="Inbox" />
            <NavItem icon={<Users size={18} />} label="Leads" />
            <NavItem icon={<Workflow size={18} />} label="Automations" />
            <NavItem icon={<BookOpen size={18} />} label="Knowledge" />

            <div className="mb-3 mt-8 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Manage
            </div>

            <NavItem icon={<TrendingUp size={18} />} label="Analytics" />
            <NavItem icon={<Plug size={18} />} label="Integrations" />
            <NavItem icon={<Settings size={18} />} label="Settings" />
          </nav>

          <div className="border-t border-slate-200 p-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold">Your AI workforce</div>
              <div className="mb-3 text-xs leading-5 text-slate-500">
                3 AI employees are currently working for your business.
              </div>
              <button className="flex items-center gap-1 text-xs font-semibold text-slate-900">
                Manage employees
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </aside>

        {/* Main */}
        <section className="flex-1">
          {/* Top bar */}
          <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6 lg:px-8">
            <div>
              <div className="text-sm text-slate-500">Workspace</div>
              <div className="font-semibold">My Business</div>
            </div>

            <div className="flex items-center gap-4">
              <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <MessageSquare size={19} />
              </button>

              <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  BG
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-semibold">Billy</div>
                  <div className="text-xs text-slate-500">Administrator</div>
                </div>
              </div>
            </div>
          </header>

          <div className="p-6 lg:p-8">
            {/* Welcome */}
            <div className="mb-8">
              <p className="mb-2 text-sm font-medium text-slate-500">
                Friday, August 14
              </p>
              <h1 className="text-3xl font-bold tracking-tight">
                Good morning, Billy.
              </h1>
              <p className="mt-2 max-w-2xl text-slate-500">
          Here&apos;s what&apos;s happening with your AI workforce today.
              </p>
            </div>

            {/* Metrics */}
            <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Leads today"
                value="80"
                change="+18%"
                icon={<Users size={19} />}
              />
              <Metric
                label="Conversations"
                value="93"
                change="+12%"
                icon={<MessageSquare size={19} />}
              />
              <Metric
                label="Qualified leads"
                value="39"
                change="+24%"
                icon={<UserCheck size={19} />}
              />
              <Metric
                label="Follow-ups"
                value="17"
                change="+9%"
                icon={<TrendingUp size={19} />}
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
              {/* Employees */}
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-200 p-6">
                  <div>
                    <h2 className="font-semibold">AI Employees</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Your digital workforce at work.
                    </p>
                  </div>
                  <button className="text-sm font-semibold text-slate-700">
                    View all
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {employees.map((employee) => (
                    <div
                      key={employee.name}
                      className="flex items-center justify-between p-5"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold">
                          {employee.initials}
                        </div>

                        <div>
                          <div className="font-semibold">{employee.name}</div>
                          <div className="mt-1 text-sm text-slate-500">
                            {employee.role}
                          </div>
                        </div>
                      </div>

                      <div className="hidden items-center gap-8 md:flex">
                        <div>
                          <div className="text-xs text-slate-400">
                            Conversations
                          </div>
                          <div className="mt-1 font-semibold">
                            {employee.conversations}
                          </div>
                        </div>

                        <div>
                          <div className="text-xs text-slate-400">
                            Qualified
                          </div>
                          <div className="mt-1 font-semibold">
                            {employee.qualified}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-medium">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          {employee.status}
                        </div>

                        <button className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                          <MoreHorizontal size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Activity */}
              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-200 p-6">
                  <h2 className="font-semibold">Recent activity</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    What&apos;s happening across your workforce.
                  </p>
                </div>

                <div className="p-6">
                  <div className="space-y-6">
                    {activities.map((activity, index) => (
                      <div key={activity} className="flex gap-3">
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <Bot size={15} />
                        </div>

                        <div>
                          <p className="text-sm font-medium">{activity}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {index + 2} minutes ago
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom callout */}
            <div className="mt-6 rounded-2xl bg-slate-950 p-6 text-white">
              <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                <div>
                  <div className="text-lg font-semibold">
                    Your AI workforce is working.
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    Add more AI employees or connect another business channel.
                  </div>
                </div>

                <button className="rounded-lg bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-100">
                  Explore AI Employees
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function NavItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-slate-100 text-slate-950"
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Metric({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: string;
  change: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100">
          {icon}
        </div>
        <span className="text-xs font-semibold text-emerald-600">
          {change}
        </span>
      </div>

      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}