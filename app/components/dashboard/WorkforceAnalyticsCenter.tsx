"use client";

import { useEffect, useState } from "react";

type EmployeeMetric = { id: string; name: string; type: string; status: string; conversations: number; leads: number; tasksCompleted: number; escalations: number; trend: string };
type ChannelMetric = { channel: string; conversations: number; responseTimeMinutes: number | null; leads: number };
type CountItem = { label: string; count: number };
type Analytics = {
  overview: { totalEmployees: number; activeEmployees: number; conversationsHandled: number; leadsGenerated: number; tasksCompleted: number; humanEscalations: number; averageResponseMinutes: number | null };
  employees: EmployeeMetric[];
  channels: ChannelMetric[];
  customerIntelligence: { commonQuestions: CountItem[]; popularServices: CountItem[]; peakEnquiryTimes: CountItem[]; sentiment: null };
};

export default function WorkforceAnalyticsCenter() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadAnalytics() {
      try {
        const response = await fetch("/api/analytics/workforce", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load workforce analytics.");
        if (!cancelled) setAnalytics(data);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load workforce analytics.");
      }
    }
    void loadAnalytics();
    return () => { cancelled = true; };
  }, []);

  if (error) return <PanelState message={error} error />;
  if (!analytics) return <PanelState message="Loading AI workforce analytics..." />;

  return <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">AI Workforce Analytics</p><h2 className="mt-2 text-2xl font-black">Operational performance</h2><p className="mt-2 text-sm text-white/40">Measured activity from your connected AI employees and customer channels.</p></div><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300">Live data</span></div>
    <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{[["AI employees", analytics.overview.totalEmployees], ["Active", analytics.overview.activeEmployees], ["Conversations", analytics.overview.conversationsHandled], ["Leads", analytics.overview.leadsGenerated], ["Tasks completed", analytics.overview.tasksCompleted], ["Escalations", analytics.overview.humanEscalations], ["Avg response", analytics.overview.averageResponseMinutes == null ? "Not tracked" : `${analytics.overview.averageResponseMinutes} min`]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-xl font-black">{value}</p></div>)}</div>
    <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"><div><h3 className="text-sm font-bold text-white/80">Employee performance</h3><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/30"><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Conversations</th><th className="px-3 py-3">Leads</th><th className="px-3 py-3">Tasks</th><th className="px-3 py-3">Escalations</th><th className="px-3 py-3">Trend</th></tr></thead><tbody>{analytics.employees.length ? analytics.employees.map((employee) => <tr key={employee.id} className="border-b border-white/[0.06] text-white/65"><td className="px-3 py-4 font-semibold">{employee.name}<span className="block text-xs capitalize text-white/30">{employee.type.replaceAll("-", " ")}</span></td><td className="px-3 py-4"><span className="text-xs text-emerald-300">{employee.status}</span></td><td className="px-3 py-4">{employee.conversations}</td><td className="px-3 py-4">{employee.leads}</td><td className="px-3 py-4">{employee.tasksCompleted}</td><td className="px-3 py-4">{employee.escalations}</td><td className="px-3 py-4 text-xs text-white/35">{employee.trend}</td></tr>) : <tr><td className="px-3 py-6 text-white/35" colSpan={7}>No employee activity recorded yet.</td></tr>}</tbody></table></div></div><div><h3 className="text-sm font-bold text-white/80">Channel analytics</h3><div className="mt-3 space-y-3">{analytics.channels.map((channel) => <div key={channel.channel} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><div className="flex items-center justify-between"><p className="font-semibold capitalize text-white/70">{channel.channel.replaceAll("_", " ")}</p><span className="text-xs text-cyan-300">{channel.conversations} conversations</span></div><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><span className="text-white/35">Response time <strong className="ml-1 text-white/65">{channel.responseTimeMinutes == null ? "Not tracked" : `${channel.responseTimeMinutes} min`}</strong></span><span className="text-white/35">Leads <strong className="ml-1 text-white/65">{channel.leads}</strong></span></div></div>)}</div></div></div>
    <div className="mt-8 grid gap-6 border-t border-white/10 pt-6 lg:grid-cols-3"><InsightList title="Most common questions" items={analytics.customerIntelligence.commonQuestions} empty="No question data yet." /><InsightList title="Popular services" items={analytics.customerIntelligence.popularServices} empty="No service data yet." /><InsightList title="Peak enquiry times" items={analytics.customerIntelligence.peakEnquiryTimes} empty="No enquiry timing data yet." /></div>
    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/30">Customer sentiment</p><p className="mt-2 text-sm text-white/40">Not tracked. No sentiment signal exists in the current conversation data.</p></div>
  </section>;
}

function InsightList({ title, items, empty }: { title: string; items: CountItem[]; empty: string }) { return <div><h3 className="text-sm font-bold text-white/75">{title}</h3><div className="mt-3 space-y-2">{items.length ? items.map((item) => <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2.5 text-xs"><span className="truncate text-white/55">{item.label}</span><span className="shrink-0 text-cyan-300">{item.count}</span></div>) : <p className="text-xs text-white/30">{empty}</p>}</div></div>; }
function PanelState({ message, error = false }: { message: string; error?: boolean }) { return <div className={`mt-8 rounded-3xl border p-6 text-sm ${error ? "border-red-400/20 bg-red-400/[0.04] text-red-200" : "border-white/10 bg-white/[0.025] text-white/40"}`}>{message}</div>; }
