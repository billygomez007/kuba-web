"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Sales = { activities: number; pipeline: Record<string, number>; pipelineValue: number; dealStatus: { open: number; won: number; lost: number; openValue: number; wonValue: number; lostValue: number }; leadSources: Array<{ label: string; count: number }>; employeeLeads: Array<{ label: string; count: number }> };
type Data = { overview: { leads: number; newLeads: number; qualifiedLeads: number; conversionRate: number }; sales: Sales };

export default function SalesIntelligencePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/analytics", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Sales Intelligence.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-emerald-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Sales intelligence</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Lead volume, pipeline distribution, and sales activity from real lead records. &quot;Estimated pipeline value&quot; is the sum of each lead&apos;s recorded estimated value — a sales estimate, not booked revenue.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}
        {data && <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/dashboard/sales" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-emerald-300/25"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Active leads</p><p className="mt-3 text-3xl font-black text-emerald-200">{data.overview.leads}</p></Link>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">New leads</p><p className="mt-3 text-3xl font-black text-emerald-200">{data.overview.newLeads}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Qualified</p><p className="mt-3 text-3xl font-black text-emerald-200">{data.overview.qualifiedLeads}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Qualify rate</p><p className="mt-3 text-3xl font-black text-emerald-200">{data.overview.conversionRate}%</p></div>
          </section>
          <div className="mt-7 grid gap-6 xl:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-xl font-black">Pipeline by stage</h2>
              <div className="mt-5 space-y-2">{Object.entries(data.sales.pipeline).length ? Object.entries(data.sales.pipeline).map(([stage, count]) => <div key={stage} className="flex items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3 text-sm"><span className="capitalize text-white/70">{stage}</span><span className="font-bold text-emerald-200">{count}</span></div>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No pipeline stages recorded.</p>}</div>
              <p className="mt-4 text-xs text-white/30">Estimated pipeline value: {data.sales.pipelineValue.toLocaleString()} (open {data.sales.dealStatus.openValue.toLocaleString()} · won {data.sales.dealStatus.wonValue.toLocaleString()} · lost {data.sales.dealStatus.lostValue.toLocaleString()})</p>
            </section>
            <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6">
              <h2 className="text-xl font-black">Lead sources</h2>
              <div className="mt-5 space-y-2">{data.sales.leadSources.length ? data.sales.leadSources.map((source) => <div key={source.label} className="flex items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3 text-sm"><span className="text-white/70">{source.label}</span><span className="font-bold text-emerald-200">{source.count}</span></div>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No lead source data recorded.</p>}</div>
            </section>
          </div>
        </>}
      </div>
    </main>
  );
}
