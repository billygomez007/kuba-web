"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Data = { overview: { customers: number; newCustomers: number; pendingFollowUps: number; overdueFollowUps: number }; communications: { conversations: number; openConversations: number } };

function Card({ label, value, href }: { label: string; value: number | string; href: string }) {
  return <Link href={href} className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-violet-300/25"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">{label}</p><p className="mt-3 text-3xl font-black text-violet-200">{value}</p></Link>;
}

export default function CustomerIntelligencePage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/analytics", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Customer Intelligence.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-violet-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Customer intelligence</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Customer activity from real records. Satisfaction, NPS, lifetime value, and churn probability aren&apos;t shown here — no authoritative survey or scoring system is connected yet.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}
        {data && <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card label="Customers" value={data.overview.customers} href="/dashboard/customers" />
          <Card label="New customers" value={data.overview.newCustomers} href="/dashboard/customers" />
          <Card label="Conversations" value={data.communications.conversations} href="/dashboard/conversations" />
          <Card label="Open conversations" value={data.communications.openConversations} href="/dashboard/conversations" />
          <Card label="Pending follow-ups" value={data.overview.pendingFollowUps} href="/dashboard/follow-ups" />
          <Card label="Overdue follow-ups" value={data.overview.overdueFollowUps} href="/dashboard/follow-ups" />
        </section>}
      </div>
    </main>
  );
}
