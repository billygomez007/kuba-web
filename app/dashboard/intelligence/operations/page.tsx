"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Data = { metrics: Record<string, number>; alerts: Array<{ id: string; type: string; title: string; detail: string; occurredAt: string; href: string }> };

const metricCards = [
  ["Open tasks", "openTasks", "/dashboard/tasks"], ["Overdue tasks", "overdueTasks", "/dashboard/tasks"],
  ["Pending approvals", "pendingApprovals", "/dashboard/approvals"], ["Active automations", "activeAutomations", "/dashboard/automations"],
  ["Failed runs", "failedAutomationRuns", "/dashboard/automations"], ["Operational alerts", "operationalAlerts", "/dashboard/business-operations/alerts"],
] as const;

export default function OperationsAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/business-operations", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Operations Analytics.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Operations analytics</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">The same authoritative Business Operations data (tasks, approvals, automations, alerts), presented as an intelligence view. See Business Operations for the full working surface.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}
        {data && <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{metricCards.map(([label, key, href]) => <Link key={key} href={href} className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-cyan-300/25"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</p><p className="mt-3 text-3xl font-black text-cyan-100">{data.metrics[key] ?? 0}</p></Link>)}</section>
          <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-xl font-black">Recent alerts</h2>
            <div className="mt-5 space-y-3">{data.alerts.length ? data.alerts.slice(0, 8).map((alert) => <Link key={alert.id} href={alert.href} className="block rounded-2xl border border-white/[0.07] p-4 hover:border-red-300/20"><p className="text-[10px] font-bold uppercase tracking-wider text-red-300/70">{alert.type.replaceAll("_", " ")}</p><p className="mt-1 text-sm font-bold">{alert.title}</p></Link>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No operational alerts.</p>}</div>
          </section>
        </>}
      </div>
    </main>
  );
}
