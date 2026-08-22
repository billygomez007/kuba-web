"use client";

import Link from "next/link";
import {
  ArrowRight,
  Headphones,
  Rocket,
  Megaphone,
  BrainCircuit,
  Users,
  Settings2,
  CalendarCheck,
} from "lucide-react";
import MarketingHeader from "../components/MarketingHeader";
import BackNavigation from "../components/BackNavigation";

const solutions = [
  {
    title: "Customer Service",
    id: "customer-support",
    icon: Headphones,
    description:
      "AI employees that answer customer questions, provide support, and deliver instant assistance 24/7.",
  },
  {
    title: "Sales & Lead Generation",
    id: "increase-sales",
    icon: Rocket,
    description:
      "Capture leads, qualify prospects, follow up with customers, and help your team close more opportunities.",
  },
  {
    title: "Marketing Automation",
    id: "reduce-manual-work",
    icon: Megaphone,
    description:
      "Automate campaigns, customer engagement, content workflows, and marketing processes.",
  },
  {
    title: "Finance & Accounting",
    id: "ai-business-assistant",
    icon: BrainCircuit,
    description:
      "Automate finance workflows, reporting, and business processes.",
  },
  {
    title: "Human Resources",
    id: "human-resources",
    icon: Users,
    description:
      "Support recruitment, onboarding, employee communication, and HR services.",
  },
  {
    title: "Business Operations",
    id: "improve-operations",
    icon: Settings2,
    description:
      "Improve workflows, reduce repetitive tasks, and help teams operate efficiently.",
  },
  {
    title: "Appointments & Bookings",
    id: "appointments",
    icon: CalendarCheck,
    description:
      "Manage scheduling, reservations, reminders, and customer appointments automatically.",
  },
];

export default function SolutionsPage() {
  return (
    <main className="min-h-screen bg-[#060609] text-white">
      <MarketingHeader />
      <div className="mx-auto max-w-7xl px-6 pt-28 lg:px-8">
        <BackNavigation label="Back to SuperKuba" />
      </div>

      <section className="px-6 pb-20 pt-12 lg:px-8">
        <div className="mx-auto max-w-7xl text-center">

          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-white/70">
            Solutions
          </div>

          <h1 className="mt-8 text-5xl font-black tracking-tight sm:text-6xl">
            AI Solutions For
            <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              Every Part Of Your Business.
            </span>
          </h1>

          <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/55">
            Kuba provides intelligent AI employees that help businesses
            automate communication, improve productivity, increase sales,
            and streamline daily operations.
          </p>

        </div>
      </section>


      <section className="px-6 pb-28 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3">

          {solutions.map((solution) => {
            const Icon = solution.icon;

            return (
              <div
                key={solution.title}
                id={solution.id}
                className="rounded-3xl border border-white/10 bg-white/[0.04] p-8 transition hover:-translate-y-1 hover:border-white/20"
              >
                <Icon className="h-8 w-8 text-violet-300" />

                <h2 className="mt-6 text-2xl font-bold">
                  {solution.title}
                </h2>

                <p className="mt-3 text-white/50">
                  {solution.description}
                </p>

                <Link
                  href="/signup"
                  className="mt-6 inline-flex items-center gap-2 text-sm font-bold"
                >
                  Build with Kuba
                  <ArrowRight className="h-4 w-4" />
                </Link>

              </div>
            );
          })}

        </div>
      </section>

    </main>
  );
}
