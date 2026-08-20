"use client";

import Link from "next/link";
import {
  ArrowRight,
  Sparkles,
  Bot,
  Workflow,
  BrainCircuit,
  Plug,
  Zap,
  Check,
} from "lucide-react";

const capabilities = [
  {
    icon: Bot,
    label: "AI Employees",
  },
  {
    icon: Zap,
    label: "Business Automation",
  },
  {
    icon: Workflow,
    label: "Workflows",
  },
  {
    icon: BrainCircuit,
    label: "Knowledge",
  },
  {
    icon: Plug,
    label: "Integrations",
  },
];

export default function KubaHero() {
  return (
    <section className="relative min-h-screen overflow-hidden bg-[#07070A] text-white">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-violet-600/25 blur-[140px]" />

        <div className="absolute -right-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-400/20 blur-[140px]" />

        <div className="absolute bottom-[-200px] left-[35%] h-[500px] w-[500px] rounded-full bg-fuchsia-600/15 blur-[150px]" />
      </div>

      {/* Background grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Navigation */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-black shadow-lg shadow-white/10">
            <span className="text-xl font-black">K</span>
          </div>

          <span className="text-2xl font-black tracking-tight">
            kuba<span className="text-violet-400">.</span>
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-8 text-sm font-medium text-white/60 md:flex">
          <Link
            href="#workforce"
            className="transition hover:text-white"
          >
            AI Workforce
          </Link>

          <Link
            href="#automation"
            className="transition hover:text-white"
          >
            Automation
          </Link>

          <Link
            href="#solutions"
            className="transition hover:text-white"
          >
            Solutions
          </Link>

          <Link
            href="#pricing"
            className="transition hover:text-white"
          >
            Pricing
          </Link>
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden px-4 py-2 text-sm font-semibold text-white/70 transition hover:text-white sm:block"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-white/90"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Main hero */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-20 lg:px-8 lg:pb-32 lg:pt-28">
        <div className="mx-auto max-w-5xl text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur-xl">
            <Sparkles className="h-4 w-4 text-violet-400" />

            The AI workforce for modern businesses

            <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          </div>

          {/* Main headline */}
          <h1 className="text-balance text-5xl font-black leading-[0.95] tracking-[-0.05em] sm:text-6xl md:text-7xl lg:text-[88px]">
            Your Business.
            <br />

            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              Powered by an AI Workforce.
            </span>
          </h1>

          {/* Supporting text */}
          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/60 sm:text-xl">
            AI employees, business automation, workflows, knowledge,
            integrations, and intelligent operations in one powerful platform.
          </p>

          {/* CTA buttons */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group flex items-center gap-3 rounded-full bg-white px-7 py-4 text-base font-bold text-black shadow-2xl shadow-white/10 transition hover:scale-105"
            >
              Build your AI workforce

              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="#demo"
              className="flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-7 py-4 text-base font-semibold text-white backdrop-blur-xl transition hover:border-white/30 hover:bg-white/[0.09]"
            >
              See how Kuba works
            </Link>
          </div>

          {/* Trust statement */}
          <div className="mt-7 flex items-center justify-center gap-2 text-sm text-white/40">
            <Check className="h-4 w-4 text-emerald-400" />

            Start with one AI employee. Build your workforce as you grow.
          </div>
        </div>

        {/* Capability pills */}
        <div
          id="workforce"
          className="mx-auto mt-20 flex max-w-5xl flex-wrap items-center justify-center gap-3"
        >
          {capabilities.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.label}
                className="group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-4 py-2.5 text-sm font-medium text-white/65 backdrop-blur-xl transition hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.08] hover:text-white"
              >
                <Icon className="h-4 w-4 text-violet-400 transition group-hover:text-cyan-300" />

                {item.label}
              </div>
            );
          })}
        </div>

        {/* AI workforce dashboard */}
        <div className="relative mx-auto mt-16 max-w-6xl">
          {/* Dashboard glow */}
          <div className="absolute inset-x-20 top-20 h-60 rounded-full bg-violet-600/20 blur-[100px]" />

          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] p-2 shadow-2xl shadow-black/40 backdrop-blur-2xl">
            <div className="rounded-[22px] border border-white/10 bg-[#0D0D12] p-6 sm:p-8">
              {/* Dashboard header */}
              <div className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-white/30">
                    Kuba AI Workforce
                  </div>

                  <div className="mt-1 text-xl font-bold">
                    Your AI team is working
                  </div>
                </div>

                <div className="flex w-fit items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                  8 employees active
                </div>
              </div>

              {/* Employee cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <EmployeeCard
                  icon="✦"
                  title="Receptionist"
                  description="Handling customer inquiries"
                  status="Working"
                  gradient="from-violet-500/20"
                />

                <EmployeeCard
                  icon="↗"
                  title="Sales"
                  description="Qualifying new leads"
                  status="Working"
                  gradient="from-cyan-500/20"
                />

                <EmployeeCard
                  icon="◎"
                  title="Support"
                  description="Resolving customer issues"
                  status="Working"
                  gradient="from-fuchsia-500/20"
                />

                <EmployeeCard
                  icon="◈"
                  title="Appointment"
                  description="Managing bookings"
                  status="Working"
                  gradient="from-emerald-500/20"
                />
              </div>

              {/* Workflow */}
              <div
                id="automation"
                className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5"
              >
                <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-sm font-semibold text-white/70">
                    Active workflow
                  </span>

                  <span className="text-xs text-white/30">
                    New customer inquiry
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {[
                    "Customer",
                    "Receptionist AI",
                    "Sales AI",
                    "CRM",
                    "Follow-up",
                  ].map((step, index, arr) => (
                    <div
                      key={step}
                      className="flex items-center gap-2"
                    >
                      <div
                        className={`rounded-lg border px-3 py-2 text-xs font-medium ${
                          index === 1
                            ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                            : "border-white/10 bg-white/[0.04] text-white/50"
                        }`}
                      >
                        {step}
                      </div>

                      {index < arr.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-white/20" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom positioning */}
        <div
          id="solutions"
          className="mx-auto mt-20 max-w-4xl text-center"
        >
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-violet-400">
            One intelligent platform
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            More than AI employees.
            <br />

            <span className="text-white/40">
              An AI operating layer for your business.
            </span>
          </h2>
        </div>
      </div>
    </section>
  );
}

/* Employee card */

function EmployeeCard({
  icon,
  title,
  description,
  status,
  gradient,
}: {
  icon: string;
  title: string;
  description: string;
  status: string;
  gradient: string;
}) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${gradient} to-transparent p-5 transition duration-300 hover:-translate-y-1 hover:border-white/20`}
    >
      {/* Card glow */}
      <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/[0.03] blur-2xl" />

      <div className="relative">
        {/* Icon + status */}
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-lg">
            {icon}
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

            {status}
          </div>
        </div>

        {/* Name */}
        <h3 className="mt-5 font-bold">
          {title} AI
        </h3>

        {/* Description */}
        <p className="mt-1 text-xs leading-5 text-white/40">
          {description}
        </p>
      </div>
    </div>
  );
}