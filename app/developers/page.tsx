import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Developers | SuperKuba",
  description: "SuperKuba's public developer platform and API are not available yet.",
  alternates: { canonical: "/developers" },
};

const plannedTopics = [
  "Getting Started",
  "Marketplace Products",
  "AI Employee Templates",
  "Automation Templates",
  "Integrations",
  "Authentication",
  "Permissions",
  "Webhooks",
  "Publishing Guidelines",
];

export default function DevelopersPage() {
  return (
    <main className="min-h-screen bg-[#050507] px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-black">
          SuperKuba Developers
        </Link>

        <div className="mt-16 flex items-center gap-3">
          <h1 className="text-5xl font-black">Build into the SuperKuba Marketplace.</h1>
        </div>

        <span className="mt-4 inline-flex items-center rounded-full border border-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white/40">
          Coming soon
        </span>

        <p className="mt-5 max-w-2xl text-base leading-7 text-white/45">
          A public developer platform for employee templates, skills, automation templates,
          workforce packages, and integration connectors is not available yet. The topics
          below describe what is planned; none of them are live documentation today.
        </p>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/35">
          SuperKuba currently has a verified-partner marketplace program.{" "}
          <Link href="/partner" className="font-semibold text-cyan-300 hover:text-cyan-200">
            Learn about the Partner Program
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-3 sm:grid-cols-2">
          {plannedTopics.map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-sm font-semibold text-white/40"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
