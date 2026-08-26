"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type BriefingItem = { id: string; category: string; severity: "high" | "medium" | "low"; title: string; explanation: string; evidence: string; sourceDomain: string; href: string; generatedAt: string };
type Data = { status: "needs_attention" | "monitor" | "steady"; briefing: BriefingItem[]; generatedAt: string };

const severityStyle: Record<string, string> = {
  high: "border-red-400/25 bg-red-400/[0.05] text-red-300",
  medium: "border-amber-400/25 bg-amber-400/[0.05] text-amber-300",
  low: "border-cyan-400/25 bg-cyan-400/[0.05] text-cyan-300",
};

const statusCopy: Record<string, { label: string; tone: string }> = {
  needs_attention: { label: "Needs attention", tone: "text-red-300" },
  monitor: { label: "Monitor", tone: "text-amber-300" },
  steady: { label: "Steady", tone: "text-emerald-300" },
};

export default function ExecutiveIntelligencePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetch("/api/analytics/executive", { cache: "no-store" })
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Unable to load Executive Intelligence.");
          setData(body);
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Executive Intelligence."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-violet-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Executive briefing</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">A deterministic, evidence-backed summary of what changed and what needs attention across this business. Every item below is generated from real records — nothing here is AI-invented.</p>

        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}

        {data && (
          <>
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
              <span className={`h-2.5 w-2.5 rounded-full ${data.status === "needs_attention" ? "bg-red-400" : data.status === "monitor" ? "bg-amber-400" : "bg-emerald-400"}`} />
              <p className={`text-sm font-bold ${statusCopy[data.status].tone}`}>{statusCopy[data.status].label}</p>
              <p className="text-xs text-white/30">Generated {new Date(data.generatedAt).toLocaleString()}</p>
            </div>

            <section className="mt-6 space-y-3">
              {data.briefing.length ? data.briefing.map((item) => (
                <Link key={item.id} href={item.href} className={`block rounded-3xl border p-6 transition hover:border-white/20 ${severityStyle[item.severity]}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider">{item.sourceDomain} · {item.severity} priority</p>
                  </div>
                  <h2 className="mt-2 text-xl font-black text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-white/60">{item.explanation}</p>
                  {item.evidence && <p className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/45">Evidence: {item.evidence}</p>}
                </Link>
              )) : (
                <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
                  <p className="text-lg font-bold">Nothing requires attention right now</p>
                  <p className="mt-2 text-sm text-white/35">No overdue tasks, pending approvals, failed automations, or overdue follow-ups were found for this business.</p>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
