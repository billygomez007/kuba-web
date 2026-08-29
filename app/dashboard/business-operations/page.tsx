"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import LoadingState from "@/app/components/ui/LoadingState";
import MetricCard from "@/app/components/ui/MetricCard";
import StatusBadge from "@/app/components/ui/StatusBadge";

type Data = {
  metrics: Record<string, number>;
  recentRuns: Array<{ id: string; automationId: string; status: string; triggerType: string; startedAt: string; error: string | null }>;
  alerts: Array<{ id: string; type: string; title: string; detail: string; occurredAt: string; href: string }>;
  activity: Array<{ id: string; actor: string; title: string; detail: string | null; occurredAt: string }>;
};

const metricCards = [
  ["Open tasks", "openTasks", "/dashboard/tasks"], ["Due today", "tasksDueToday", "/dashboard/tasks"],
  ["Overdue tasks", "overdueTasks", "/dashboard/tasks"], ["Pending approvals", "pendingApprovals", "/dashboard/approvals"],
  ["Active automations", "activeAutomations", "/dashboard/automations"], ["Recent runs", "recentAutomationRuns", "/dashboard/automations"],
  ["Failed runs", "failedAutomationRuns", "/dashboard/business-operations/alerts"], ["Operational alerts", "operationalAlerts", "/dashboard/business-operations/alerts"],
] as const;

export default function BusinessOperationsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { void fetch("/api/business-operations", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load operations.")).finally(() => setLoading(false)); }, []);
  return <main className="min-h-screen bg-surface-page px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12"><div className="mx-auto max-w-7xl"><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Business Operations</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Operations overview</h1><p className="mt-3 text-sm text-text-tertiary">Live operational records for the currently selected business.</p>{error ? <p className="mt-7 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p> : loading ? <LoadingState message="Loading operations overview..." /> : <><section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(([label, key, href]) => <MetricCard key={key} label={label} value={data?.metrics[key] ?? "…"} href={href} />)}</section><div className="mt-7 grid gap-6 xl:grid-cols-2"><Panel title="Recent automation runs" empty="No automation runs recorded.">{data?.recentRuns.map((run) => <Link key={run.id} href={`/dashboard/automations/${run.automationId}`} className="block rounded-2xl border border-white/[0.07] p-4"><div className="flex justify-between gap-3"><span className="text-sm font-bold">{run.triggerType.replaceAll(".", " ")}</span><StatusBadge status={run.status} /></div><p className="mt-2 text-xs text-text-muted">{new Date(run.startedAt).toLocaleString()}{run.error ? ` · ${run.error}` : ""}</p></Link>)}</Panel><Panel title="Recent operational activity" empty="No recent operational activity.">{data?.activity.map((item) => <div key={item.id} className="rounded-2xl border border-white/[0.07] p-4"><p className="text-[10px] uppercase tracking-wider text-violet-300/70">{item.actor}</p><p className="mt-1 text-sm font-bold">{item.title}</p><p className="mt-2 text-xs text-text-muted">{item.detail || "Recorded operational event"} · {new Date(item.occurredAt).toLocaleString()}</p></div>)}</Panel></div></>}</div></main>;
}

function Panel({ title, empty, children }: { title: string; empty: string; children?: React.ReactNode[] }) { const items = children?.filter(Boolean) || []; return <section className="rounded-3xl border border-border-default bg-surface-card p-6"><h2 className="text-xl font-black">{title}</h2><div className="mt-5 space-y-3">{items.length ? items : <p className="rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">{empty}</p>}</div></section>; }
