"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type Insight = { type: string; title: string; message: string; priority: "high" | "medium" | "low" };
type Alert = { id: string; type: string; title: string; detail: string; occurredAt: string; href: string };
type InsightsData = { insights: Insight[] };
type OperationsData = { alerts: Alert[] };

const priorityStyle: Record<string, string> = { high: "border-red-400/25 bg-red-400/[0.05]", medium: "border-amber-400/25 bg-amber-400/[0.05]", low: "border-cyan-400/25 bg-cyan-400/[0.05]" };

export default function InsightsAlertsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([
        fetch("/api/analytics/insights", { cache: "no-store" }).then((r) => r.json() as Promise<InsightsData & { error?: string }>),
        fetch("/api/business-operations", { cache: "no-store" }).then((r) => r.json() as Promise<OperationsData & { error?: string }>),
      ])
        .then(([insightsBody, opsBody]) => {
          if (insightsBody.error) throw new Error(insightsBody.error);
          if (opsBody.error) throw new Error(opsBody.error);
          setInsights(insightsBody.insights || []);
          setAlerts(opsBody.alerts || []);
        })
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load Insights & Alerts."));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard/analytics" className="text-xs text-white/40 hover:text-cyan-300">← Analytics</Link>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-red-300/70">Intelligence</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Insights &amp; alerts</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Deterministic business signals and real operational alerts in one place. Priority is rule-based, not AI-guessed.</p>
        {error && <p className="mt-6 rounded-2xl border border-red-400/20 p-4 text-red-200">{error}</p>}

        <section className="mt-8">
          <h2 className="text-xl font-black">Business insights</h2>
          <div className="mt-4 space-y-3">{insights.length ? insights.map((insight, index) => <div key={`${insight.type}-${index}`} className={`rounded-3xl border p-5 ${priorityStyle[insight.priority]}`}><p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{insight.type} · {insight.priority} priority</p><h3 className="mt-2 font-black">{insight.title}</h3><p className="mt-2 text-sm leading-6 text-white/60">{insight.message}</p></div>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No insights generated yet.</p>}</div>
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-black">Operational alerts</h2>
          <div className="mt-4 space-y-3">{alerts.length ? alerts.map((alert) => <Link key={alert.id} href={alert.href} className="block rounded-3xl border border-white/10 bg-white/[0.025] p-5 hover:border-red-300/20"><p className="text-[10px] font-bold uppercase tracking-wider text-red-300/70">{alert.type.replaceAll("_", " ")}</p><h3 className="mt-2 font-black">{alert.title}</h3><p className="mt-2 text-sm text-white/45">{alert.detail}</p></Link>) : <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">No operational alerts. (Growth-plan businesses see a count on Operations Overview; full alert detail requires Pro.)</p>}</div>
        </section>
      </div>
    </main>
  );
}
