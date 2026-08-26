"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Employee = { id: string; name: string; type: string; status: string; conversations: number; leads: number; tasksCompleted: number; escalations: number; trend: string };
type Data = { overview: { totalEmployees: number; activeEmployees: number; conversationsHandled: number; leadsGenerated: number; tasksCompleted: number; humanEscalations: number; averageResponseMinutes: number | null }; employees: Employee[] };

export default function AIWorkforceAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/analytics/workforce", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load AI Workforce Analytics.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">AI Workforce analytics</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Activity computed from real conversations, leads, tasks, and handoffs per AI employee. No productivity or performance score is fabricated — only counted activity.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}
        {data && <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/dashboard/ai-employees" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-cyan-300/25"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">AI employees</p><p className="mt-3 text-3xl font-black text-cyan-100">{data.overview.activeEmployees} / {data.overview.totalEmployees}</p></Link>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Conversations handled</p><p className="mt-3 text-3xl font-black text-cyan-100">{data.overview.conversationsHandled}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Tasks completed</p><p className="mt-3 text-3xl font-black text-cyan-100">{data.overview.tasksCompleted}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Human escalations</p><p className="mt-3 text-3xl font-black text-cyan-100">{data.overview.humanEscalations}</p></div>
          </section>
          <section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.02] p-6">
            <h2 className="text-xl font-black">By AI employee</h2>
            <div className="mt-5 space-y-3">{data.employees.length ? data.employees.map((employee) => <Link key={employee.id} href="/dashboard/ai-employees" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.07] p-4 hover:border-cyan-300/20"><div><p className="font-bold">{employee.name}</p><p className="text-xs text-white/35">{employee.type} · {employee.status}</p></div><div className="flex gap-4 text-xs text-white/50"><span>{employee.conversations} conversations</span><span>{employee.tasksCompleted} tasks</span><span>{employee.escalations} escalations</span></div></Link>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No AI employees recorded.</p>}</div>
          </section>
        </>}
      </div>
    </main>
  );
}
