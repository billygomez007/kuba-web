"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Overview = { customers: number; newCustomers: number; leads: number; newLeads: number; qualifiedLeads: number; conversionRate: number; completedTasks: number; pendingTasks: number; overdueTasks: number; pendingFollowUps: number; overdueFollowUps: number };
type Data = { overview: Overview; automations: { total: number; runs: number; successRate: number }; communications: { conversations: number; openConversations: number }; workforce: { employees: number; activities: number } };

function Card({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = <><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</p><p className="mt-3 text-3xl font-black text-cyan-100">{value}</p></>;
  return href ? <Link href={href} className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-cyan-300/25">{inner}</Link> : <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">{inner}</div>;
}

export default function BusinessPerformancePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/analytics", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Business Performance.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Business performance</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Operational KPIs from real records: customers, leads, task throughput, and automation activity. This is not a financial statement — revenue, profit, and margin reporting require authoritative accounting data that isn&apos;t connected yet.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}
        {data && <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card label="Customers" value={data.overview.customers} href="/dashboard/customers" />
            <Card label="New customers" value={data.overview.newCustomers} href="/dashboard/customers" />
            <Card label="Active leads" value={data.overview.leads} href="/dashboard/sales" />
            <Card label="Qualified leads" value={data.overview.qualifiedLeads} href="/dashboard/sales" />
            <Card label="Lead → qualified rate" value={`${data.overview.conversionRate}%`} />
            <Card label="Completed tasks" value={data.overview.completedTasks} href="/dashboard/tasks" />
            <Card label="Overdue tasks" value={data.overview.overdueTasks} href="/dashboard/tasks" />
            <Card label="Overdue follow-ups" value={data.overview.overdueFollowUps} href="/dashboard/follow-ups" />
          </section>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <Card label="Automation success rate" value={`${data.automations.successRate}%`} href="/dashboard/automations" />
            <Card label="Open conversations" value={data.communications.openConversations} href="/dashboard/conversations" />
            <Card label="AI workforce activity" value={data.workforce.activities} href="/dashboard/intelligence/ai-workforce" />
          </div>
        </>}
      </div>
    </main>
  );
}
