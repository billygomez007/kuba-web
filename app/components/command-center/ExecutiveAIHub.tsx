"use client";

import Link from "next/link";

const executives = [
  {
    icon: "✦",
    name: "Kuba CEO",
    description:
      "Business intelligence, decisions, and executive guidance.",
    action: "Ask Kuba",
    href: "#kuba-chat",
  },
  {
    icon: "↗",
    name: "Kuba Sales",
    description:
      "Revenue growth, leads, opportunities, and follow-ups.",
    action: "Open Sales",
    href: "/dashboard/employees",
  },
  {
    icon: "◎",
    name: "Kuba Receptionist",
    description:
      "Customer conversations and business enquiries.",
    action: "Open Receptionist",
    href: "/dashboard/employees",
  },
  {
    icon: "◈",
    name: "Kuba Accountant",
    description:
      "Financial intelligence and accounting workflows.",
    action: "Open Finance",
    href: "/dashboard/employees",
  },
];

export default function ExecutiveAIHub() {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">

      <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300/70">
        Executive Team
      </p>

      <h2 className="mt-3 text-2xl font-black">
        Your AI Executive Team
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/40">
        Work with specialized AI executives that help you operate and grow your business.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

        {executives.map((executive) => (
          <Link
            key={executive.name}
            href={executive.href}
            className="rounded-2xl border border-white/10 bg-black/20 p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.06]"
          >

            <div className="flex h-10 w-10 items-center-center justify-center rounded-xl bg-white/[0.06] text-lg">
              {executive.icon}
            </div>

            <h3 className="mt-5 font-bold">
              {executive.name}
            </h3>

            <p className="mt-2 text-sm leading-5 text-white/40">
              {executive.description}
            </p>

            <p className="mt-4 text-xs font-bold text-cyan-300">
              {executive.action} →
            </p>

          </Link>
        ))}

      </div>

    </section>
  );
}
