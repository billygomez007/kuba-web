"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import DashboardMockup from "./components/mockups/DashboardMockup";
import EmployeeShowcase from "./components/EmployeeShowcase";
import EmployeeWorkspaceMockup from "./components/mockups/EmployeeWorkspaceMockup";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  Globe2,
  Phone,
  Headphones,
  Megaphone,
  MessageSquare,
  Network,
  Plug,
  Rocket,
  Settings2,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

const employees = [
  {
    icon: "✦",
    title: "Receptionist AI",
    description: "Greets customers, answers questions and routes conversations.",
  },
  {
    icon: "↗",
    title: "Sales AI",
    description: "Qualifies leads, follows up and helps turn interest into revenue.",
  },
  {
    icon: "◎",
    title: "Support AI",
    description: "Handles customer questions and resolves routine issues.",
  },
  {
    icon: "◈",
    title: "Appointment AI",
    description: "Books meetings, manages availability and sends reminders.",
  },
  {
    icon: "✺",
    title: "Marketing AI",
    description: "Helps create campaigns, content and customer engagement.",
  },
  {
    icon: "₵",
    title: "Accountant AI",
    description: "Helps organize financial operations and routine accounting work.",
  },
];

const platformFeatures = [
  {
    icon: Bot,
    title: "AI Employees",
    description:
      "Deploy digital employees that perform real business tasks across your organization.",
  },
  {
    icon: Workflow,
    title: "Business Workflows",
    description:
      "Turn repetitive business processes into intelligent automated workflows.",
  },
  {
    icon: BrainCircuit,
    title: "Business Knowledge",
    description:
      "Connect your documents, policies, websites and internal knowledge to your AI workforce.",
  },
  {
    icon: Plug,
    title: "Integrations",
    description:
      "Connect Kuba to the tools, systems and channels your business already uses.",
  },
  {
    icon: Network,
    title: "AI Orchestration",
    description:
      "Let multiple AI employees collaborate and hand work from one employee to another.",
  },
  {
    icon: Settings2,
    title: "Intelligent Operations",
    description:
      "Monitor, control and improve how your AI workforce operates.",
  },
];

const industries = [
  "Travel",
  "Real Estate",
  "Healthcare",
  "Education",
  "Restaurants",
  "Professional Services",
  "E-commerce",
  "Financial Services",
];


const menuItems = [
  {
    name: "Products",
    items: [
      ["AI Employees", "/ai-employees"],
      ["AI Voice Agents", "/voice-agents"],
      ["AI Communication Platform", "/communication-platform"],
      ["AI Workforce Platform", "#platform"],
      ["Business Automation", "#solutions"],
      ["View All Products →", "/products"],
    ],
  },
  {
    name: "Solutions",
    items: [
      ["Customer Service", "#solutions"],
      ["Sales & Lead Generation", "#solutions"],
      ["Marketing Automation", "#solutions"],
      ["Finance & Accounting", "#solutions"],
      ["Human Resources", "#solutions"],
      ["Business Operations", "#solutions"],
      ["View All Solutions →", "/solutions"],
    ],
  },
  {
    name: "Industries",
    items: [
      ["Travel & Tourism", "/industries"],
      ["Real Estate", "/industries"],
      ["Healthcare", "/industries"],
      ["Education", "/industries"],
      ["Hospitality", "/industries"],
      ["Retail & E-commerce", "/industries"],
      ["Financial Services", "/industries"],
      ["View All Industries →", "/industries"],
    ],
  },
  {
    name: "Resources",
    items: [
      ["Documentation", "#resources"],
      ["Help Center", "#resources"],
      ["AI Guides", "#resources"],
      ["Blog", "#resources"],
    ],
  },
];


export default function KubaWebsite() {

  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <main className="min-h-screen overflow-hidden bg-[#060609] text-white">
      {/* =========================================================
          NAVIGATION
      ========================================================= */}

      <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/[0.06] bg-[#060609]/75 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center">
  <Image
    src="/brand/superkuba-logo.png"
    alt="SuperKuba"
    width={2132}
    height={738}
    priority
    className="h-auto w-[150px] object-contain sm:w-[175px]"
  />
</Link>

          <nav className="hidden items-center gap-8 md:flex">

            {menuItems.map((menu) => (
              <div
                key={menu.name}
                className="relative"
              >

                <button
                  onClick={() =>
                    setOpenMenu(openMenu === menu.name ? null : menu.name)
                  }
                  className="text-sm font-medium text-white/60 transition hover:text-white"
                >
                  {menu.name}
                </button>


                {openMenu === menu.name && (
                  <div className="absolute left-0 top-10 w-72 rounded-2xl border border-white/10 bg-[#0b0b12] p-4 shadow-2xl">

                    {menu.items.map(([label, link]) => (
                      <Link
                        key={label}
                        href={link}
                        className="block rounded-xl px-4 py-3 text-sm text-white/70 transition hover:bg-white/10 hover:text-white"
                      >
                        {label}
                      </Link>
                    ))}

                  </div>
                )}

              </div>
            ))}

            <Link
              href="/pricing"
              className="text-sm font-medium text-white/60 transition hover:text-white"
            >
              Pricing
            </Link>

          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-semibold text-white/70 transition hover:text-white sm:block"
            >
              Log in
            </Link>

            <Link
              href="/signup"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-105 hover:bg-white/90"
            >
              Start for Free
            </Link>
          </div>
        </div>
      </header>

      {/* =========================================================
          HERO
      ========================================================= */}

      <section className="relative min-h-screen pt-20">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-[-15%] top-[-10%] h-[650px] w-[650px] rounded-full bg-violet-700/25 blur-[150px]" />

          <div className="absolute right-[-10%] top-[5%] h-[600px] w-[600px] rounded-full bg-cyan-400/15 blur-[160px]" />

          <div className="absolute bottom-[-15%] left-[30%] h-[500px] w-[500px] rounded-full bg-fuchsia-600/15 blur-[150px]" />
        </div>

        {/* Grid */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)
            `,
            backgroundSize: "64px 64px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-6 pb-28 pt-28 lg:px-8 lg:pt-36">
          <div className="mx-auto max-w-6xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.055] px-4 py-2 text-sm font-semibold text-white/75 backdrop-blur-xl">
              <Sparkles className="h-4 w-4 text-violet-400" />
              The AI workforce for modern businesses
              <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            </div>

            {/* Headline */}
            <h1 className="text-balance text-5xl font-black leading-[0.92] tracking-[-0.055em] sm:text-6xl md:text-7xl lg:text-[92px]">
              Your Business.
              <br />

              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
                Powered by an AI Workforce.
              </span>
            </h1>

            {/* Description */}
            <p className="mx-auto mt-9 max-w-3xl text-lg leading-8 text-white/55 sm:text-xl">
              AI employees, business automation, workflows, knowledge,
              integrations, and intelligent operations in one powerful
              platform.
            </p>

            {/* Buttons */}
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/signup"
                className="group flex items-center gap-3 rounded-full bg-white px-7 py-4 text-base font-bold text-black shadow-2xl shadow-white/10 transition hover:-translate-y-1 hover:shadow-white/20"
              >
                Start for Free

                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>

              <Link
                href="/demo"
                className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-7 py-4 text-base font-semibold text-white/80 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.08]"
              >
                Book a Demo
              </Link>
            </div>

            {/* Trust */}
            <div className="mt-7 flex items-center justify-center gap-2 text-sm text-white/35">
              <Check className="h-4 w-4 text-emerald-400" />
              Start with one AI employee. Build your workforce as you grow.
            </div>
          </div>

          {/* =====================================================
              WORKFORCE VISUAL
          ===================================================== */}

          <div className="relative mx-auto mt-24 max-w-6xl">
            <div className="absolute inset-x-20 top-10 h-72 rounded-full bg-violet-600/20 blur-[110px]" />

            <div className="relative rounded-[32px] border border-white/10 bg-white/[0.045] p-2 shadow-2xl shadow-black/50 backdrop-blur-2xl">
              <div className="rounded-[26px] border border-white/10 bg-[#0C0C11] p-6 sm:p-8">
                {/* Top */}
                <div className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-left">
                    <div className="text-xs font-bold uppercase tracking-[0.25em] text-white/25">
                      SuperKuba AI Workforce
                    </div>

                    <h2 className="mt-2 text-2xl font-bold">
                      Your AI team is working.
                    </h2>
                  </div>

                  <div className="flex w-fit items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-400">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                    8 AI employees active
                  </div>
                </div>

                {/* Employee cards */}
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <MiniEmployee
                    icon="✦"
                    name="Receptionist"
                    task="Handling customer inquiries"
                    tone="violet"
                  />

                  <MiniEmployee
                    icon="↗"
                    name="Sales"
                    task="Qualifying new leads"
                    tone="cyan"
                  />

                  <MiniEmployee
                    icon="◎"
                    name="Support"
                    task="Resolving customer issues"
                    tone="fuchsia"
                  />

                  <MiniEmployee
                    icon="◈"
                    name="Appointments"
                    task="Managing bookings"
                    tone="emerald"
                  />
                </div>

                {/* Workflow */}
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-sm font-bold text-white/70">
                      AI workflow in progress
                    </span>

                    <span className="text-xs text-white/30">
                      New customer inquiry
                    </span>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    {[
                      "Customer",
                      "Receptionist AI",
                      "Sales AI",
                      "CRM",
                      "Follow-up",
                    ].map((step, index, list) => (
                      <div key={step} className="flex items-center gap-2">
                        <div
                          className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                            index === 1 || index === 2
                              ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                              : "border-white/10 bg-white/[0.035] text-white/45"
                          }`}
                        >
                          {step}
                        </div>

                        {index < list.length - 1 && (
                          <ArrowRight className="h-3.5 w-3.5 text-white/20" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>


      {/* =========================================================
          KUBA DASHBOARD MOCKUP
      ========================================================= */}

      <section className="relative px-6 py-20 lg:px-8">

        <div className="mx-auto max-w-7xl">

          <DashboardMockup />

        </div>

      </section>


      {/* =========================================================
          INTRO
      ========================================================= */}

      <section
        id="workforce"
        className="border-t border-white/[0.06] bg-[#08080C] py-28"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-400">
              Meet your AI workforce
            </p>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Don&apos;t just add AI.
              <br />
              <span className="text-white/35">
                Add intelligent workers.
              </span>
            </h2>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/50">
              Give your business AI employees that can communicate with
              customers, perform tasks, follow workflows, use your knowledge
              and work together.
            </p>
          </div>

          {/* Employee grid */}
          <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((employee) => (
              <EmployeeCard key={employee.title} {...employee} />
            ))}
          </div>
        </div>
      </section>


      {/* =========================================================
          AI EMPLOYEE SHOWCASE
      ========================================================= */}

      <EmployeeShowcase />


      {/* =========================================================
          PLATFORM
      ========================================================= */}

      <section
        id="platform"
        className="relative border-t border-white/[0.06] py-28"
      >
        <div className="pointer-events-none absolute right-0 top-0 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[160px]" />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-300">
              The Kuba platform
            </p>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Everything your AI workforce needs.
            </h2>

            <p className="mt-6 text-lg leading-8 text-white/45">
              Kuba brings employees, automation, knowledge, workflows and
              integrations together in one intelligent operating layer.
            </p>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {platformFeatures.map((feature) => {
              const Icon = feature.icon;

              return (
                <div
                  key={feature.title}
                  className="group rounded-3xl border border-white/10 bg-white/[0.025] p-7 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.045]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                    <Icon className="h-5 w-5 text-violet-400 transition group-hover:text-cyan-300" />
                  </div>

                  <h3 className="mt-6 text-xl font-bold">
                    {feature.title}
                  </h3>

                  <p className="mt-3 leading-7 text-white/40">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* =========================================================
          AUTOMATION
      ========================================================= */}

      <section
        id="solutions"
        className="border-t border-white/[0.06] bg-[#08080C] py-28"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-center gap-16 lg:grid-cols-2">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-fuchsia-400">
                Business automation
              </p>

              <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
                Kuba doesn&apos;t just chat.
                <br />
                <span className="text-white/35">
                  Kuba gets work done.
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-white/45">
                Connect AI employees into complete business processes. A
                customer can start with one conversation and Kuba can carry
                the work through multiple steps, systems and employees.
              </p>

              <Link
                href="/signup"
                className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-bold text-black transition hover:scale-105"
              >
                Start building

                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Automation visualization */}
            <div className="relative">
              <div className="absolute inset-0 rounded-[40px] bg-violet-600/10 blur-[80px]" />

              <div className="relative rounded-[32px] border border-white/10 bg-[#0D0D12] p-6 shadow-2xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/25">
                      Workflow
                    </p>

                    <h3 className="mt-1 font-bold">
                      New customer → closed deal
                    </h3>
                  </div>

                  <Zap className="h-5 w-5 text-violet-400" />
                </div>

                <WorkflowStep
                  number="01"
                  title="Customer inquiry"
                  description="A customer contacts your business."
                />

                <WorkflowLine />

                <WorkflowStep
                  number="02"
                  title="Receptionist AI"
                  description="Answers questions and understands intent."
                />

                <WorkflowLine />

                <WorkflowStep
                  number="03"
                  title="Sales AI"
                  description="Qualifies the lead and recommends next steps."
                />

                <WorkflowLine />

                <WorkflowStep
                  number="04"
                  title="Follow-up automation"
                  description="Keeps the conversation moving automatically."
                  active
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          INDUSTRIES
      ========================================================= */}

      <section className="border-t border-white/[0.06] py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <p className="text-sm font-bold uppercase tracking-[0.25em] text-violet-400">
              Built for business
            </p>

            <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              One platform.
              <br />
              <span className="text-white/35">Almost any industry.</span>
            </h2>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/45">
              Start with Kuba&apos;s standard AI employees or deploy specialized
AI workforce solutions built around how your industry operates.
            </p>
          </div>

          <div className="mx-auto mt-14 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {industries.map((industry) => (
              <div
                key={industry}
                className="group flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.025] px-5 py-5 transition hover:border-violet-400/30 hover:bg-violet-400/[0.05]"
              >
                <span className="font-semibold text-white/65 group-hover:text-white">
                  {industry}
                </span>

                <ChevronRight className="h-4 w-4 text-white/20 group-hover:text-violet-400" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================================================
          BIG CTA
      ========================================================= */}

      <section
        id="pricing"
        className="relative overflow-hidden border-t border-white/[0.06] py-32"
      >
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/15 blur-[150px]" />

        <div className="relative mx-auto max-w-5xl px-6 text-center lg:px-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-black shadow-2xl">
            <Rocket className="h-7 w-7" />
          </div>

          <h2 className="mt-8 text-4xl font-black tracking-[-0.04em] sm:text-5xl lg:text-7xl">
            Start with one.
            <br />

            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              Build an entire workforce.
            </span>
          </h2>

          <p className="mx-auto mt-7 max-w-2xl text-lg leading-8 text-white/45">
            Start small. Add AI employees as your business grows. Build
            workflows, connect your systems and create an AI workforce that
            works the way your business works.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/signup"
              className="group flex items-center gap-3 rounded-full bg-white px-8 py-4 font-bold text-black transition hover:scale-105"
            >
              Build your AI workforce

              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/pricing"
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-8 py-4 font-semibold text-white/75 transition hover:bg-white/[0.08] hover:text-white"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================
          FOOTER
      ========================================================= */}

      <footer className="border-t border-white/[0.06] bg-[#050507]">
        <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
          <div className="grid gap-12 md:grid-cols-4">
            {/* Brand */}
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center">
  <Image
    src="/brand/superkuba-logo.png"
    alt="SuperKuba"
    width={2132}
    height={738}
    className="h-auto w-[170px] object-contain"
  />
</Link>

              <p className="mt-5 max-w-md leading-7 text-white/35">
                Your business, powered by an AI workforce. AI employees,
                automation, workflows, knowledge and intelligent operations
                in one platform.
              </p>
            </div>

            {/* Platform */}
            <div>
              <h3 className="font-bold">Platform</h3>

              <div className="mt-5 space-y-3 text-sm text-white/40">
                <a className="block hover:text-white" href="#workforce">
                  AI Workforce
                </a>

                <a className="block hover:text-white" href="#platform">
                  Platform
                </a>

                <a className="block hover:text-white" href="#solutions">
                  Solutions
                </a>

                <a className="block hover:text-white" href="#pricing">
                  Pricing
                </a>
              </div>
            </div>

            {/* Company */}
            <div>
              <h3 className="font-bold">SuperKuba</h3>

              <div className="mt-5 space-y-3 text-sm text-white/40">
                <Link className="block hover:text-white" href="/login">
                  Log in
                </Link>

                <Link className="block hover:text-white" href="/signup">
                  Get started
                </Link>

                <a className="block hover:text-white" href="#">
                  Contact
                </a>

                <a className="block hover:text-white" href="#">
                  Documentation
                </a>
              </div>
            </div>
          </div>

          <div className="mt-14 flex flex-col gap-4 border-t border-white/[0.06] pt-7 text-xs text-white/25 sm:flex-row sm:items-center sm:justify-between">
            <span>
              © {new Date().getFullYear()} SuperKuba AI. All rights reserved.
            </span>

            <div className="flex gap-5">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Security</span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

/* =========================================================
   EMPLOYEE CARD
========================================================= */

function EmployeeCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group rounded-3xl border border-white/10 bg-white/[0.025] p-7 transition duration-300 hover:-translate-y-1 hover:border-violet-400/25 hover:bg-white/[0.045]">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xl">
        {icon}
      </div>

      <h3 className="mt-6 text-xl font-bold">{title}</h3>

      <p className="mt-3 leading-7 text-white/40">
        {description}
      </p>

      <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-violet-400">
        Explore employee
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
  );
}

/* =========================================================
   MINI EMPLOYEE
========================================================= */

function MiniEmployee({
  icon,
  name,
  task,
  tone,
}: {
  icon: string;
  name: string;
  task: string;
  tone: "violet" | "cyan" | "fuchsia" | "emerald";
}) {
  const toneClasses = {
    violet: "bg-violet-500/10 text-violet-300",
    cyan: "bg-cyan-500/10 text-cyan-300",
    fuchsia: "bg-fuchsia-500/10 text-fuchsia-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:bg-white/[0.045]">
      <div className="flex items-center justify-between">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${toneClasses[tone]}`}
        >
          {icon}
        </div>

        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Active
        </span>
      </div>

      <h3 className="mt-5 font-bold">{name} AI</h3>

      <p className="mt-1 text-xs leading-5 text-white/35">
        {task}
      </p>
    </div>
  );
}

/* =========================================================
   WORKFLOW STEP
========================================================= */

function WorkflowStep({
  number,
  title,
  description,
  active = false,
}: {
  number: string;
  title: string;
  description: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 rounded-2xl border p-4 ${
        active
          ? "border-violet-400/25 bg-violet-400/[0.06]"
          : "border-white/10 bg-white/[0.02]"
      }`}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-[10px] font-bold text-white/30">
        {number}
      </div>

      <div>
        <h4 className="text-sm font-bold">{title}</h4>

        <p className="mt-1 text-xs text-white/35">
          {description}
        </p>
      </div>
    </div>
  );
}

/* =========================================================
   WORKFLOW LINE
========================================================= */

function WorkflowLine() {
  return (
    <div className="ml-8 h-5 w-px bg-gradient-to-b from-violet-400/30 to-transparent" />
  );
}
