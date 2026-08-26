"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type CountItem = { label: string; count: number };
type Data = {
  headcount: { total: number; active: number; byStatus: CountItem[]; byEmploymentType: CountItem[]; byDepartment: CountItem[] };
  departments: { total: number; active: number };
  attendance30d: { totalRecords: number; byStatus: CountItem[] };
  leave30d: { totalRequests: number; pending: number; approved: number };
};

function List({ title, items, empty }: { title: string; items: CountItem[]; empty: string }) {
  return <section className="rounded-3xl border border-white/10 bg-white/[0.02] p-6"><h2 className="text-xl font-black">{title}</h2><div className="mt-5 space-y-2">{items.length ? items.map((item) => <div key={item.label} className="flex items-center justify-between rounded-xl border border-white/[0.07] px-4 py-3 text-sm"><span className="capitalize text-white/70">{item.label}</span><span className="font-bold text-amber-200">{item.count}</span></div>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">{empty}</p>}</div></section>;
}

export default function HumanWorkforceAnalyticsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { const timer = window.setTimeout(() => { void fetch("/api/analytics/human-workforce", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Human Workforce Analytics.")); }, 0); return () => window.clearTimeout(timer); }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-amber-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Human Workforce analytics</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Headcount, department, attendance, and leave counts only. Salary, compensation, leave reasons, and other sensitive HR details are never included here — see Human Workforce for individual records.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}
        {data && <>
          <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Link href="/dashboard/human-workforce/employees" className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-amber-300/25"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Active employees</p><p className="mt-3 text-3xl font-black text-amber-200">{data.headcount.active} / {data.headcount.total}</p></Link>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Departments</p><p className="mt-3 text-3xl font-black text-amber-200">{data.departments.active} / {data.departments.total}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Attendance records (30d)</p><p className="mt-3 text-3xl font-black text-amber-200">{data.attendance30d.totalRecords}</p></div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/30">Leave pending (30d)</p><p className="mt-3 text-3xl font-black text-amber-200">{data.leave30d.pending}</p></div>
          </section>
          <div className="mt-7 grid gap-6 xl:grid-cols-3">
            <List title="By department" items={data.headcount.byDepartment} empty="No department assignments recorded." />
            <List title="By employment type" items={data.headcount.byEmploymentType} empty="No employment type data recorded." />
            <List title="Attendance status (30d)" items={data.attendance30d.byStatus} empty="No attendance records in the last 30 days." />
          </div>
        </>}
      </div>
    </main>
  );
}
