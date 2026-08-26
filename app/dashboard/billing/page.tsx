"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Metric = { used: number | null; limit: number | null };
type Data = { plan: { name: string; features: string[] }; provider: string; capabilities: { supportsHostedCheckout: boolean; supportsBillingPortal: boolean; supportsCancellation: boolean; supportsPlanChange: boolean }; subscription: { status: string; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean } | null; usage: { employees: Metric; automations: Metric; voiceMinutes: Metric; conversations: Metric } };

export default function BillingPage() {
  const [data, setData] = useState<Data | null>(null); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/billing/usage", { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json();
          if (!active) return;
          if (response.ok) setData(result);
          else setError(result.error || "Unable to load billing.");
        })
        .catch(() => {
          if (!active) return;
          setError("Unable to load billing.");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  if (!data) return <State message={error || "Loading billing center..."} error={Boolean(error)} />;
  async function cancel() { const response = await fetch("/api/billing/subscription", { method: "POST" }); const result = await response.json(); if (response.ok) setMessage("Cancellation requested. Provider confirmation controls the final state."); else setError(result.error || "Unable to request cancellation."); }
  async function portal() { const response = await fetch("/api/billing/portal", { method: "POST" }); const result = await response.json(); if (response.ok && result.url) window.location.assign(result.url); else setError(result.error || "Billing portal unavailable."); }
  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-6xl"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-300/70">Subscription center</p><h1 className="mt-3 text-4xl font-black">Billing & entitlements</h1><p className="mt-3 text-sm text-white/40">Provider-backed commercial state and workspace usage.</p></div><div className="flex gap-2"><Link href="/dashboard/billing/usage" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/65">Usage</Link><Link href="/dashboard/billing/plans" className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black">View plans</Link></div></header>{message && <p className="mt-5 rounded-xl border border-emerald-400/20 p-3 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-5 rounded-xl border border-red-400/20 p-3 text-sm text-red-200">{error}</p>}<section className="mt-8 rounded-3xl border border-cyan-300/20 bg-cyan-300/[0.05] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Current plan</p><div className="mt-3 flex flex-wrap items-end justify-between gap-4"><div><h2 className="text-3xl font-black">{data.plan.name}</h2><p className="mt-2 text-sm text-emerald-200">{data.subscription?.status || "legacy"} · Provider: {data.provider}</p></div><p className="text-sm text-white/40">{data.subscription?.currentPeriodEnd ? `Renews ${new Date(data.subscription.currentPeriodEnd).toLocaleDateString()}` : "Billing period not available from provider"}</p></div><div className="mt-5 flex flex-wrap gap-2">{data.capabilities.supportsBillingPortal && <button type="button" onClick={() => void portal()} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70">Manage billing</button>}{data.capabilities.supportsCancellation && data.subscription?.status && !data.subscription.cancelAtPeriodEnd && <button type="button" onClick={() => void cancel()} className="rounded-xl border border-amber-300/20 px-4 py-2.5 text-sm font-semibold text-amber-200">Cancel subscription</button>}{data.subscription?.cancelAtPeriodEnd && <span className="rounded-xl border border-amber-300/20 px-4 py-2.5 text-sm text-amber-200">Cancellation scheduled</span>}{!data.capabilities.supportsPlanChange && <span className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/45">Plan changes require a new provider subscription.</span>}</div></section><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><UsageCard label="AI employees" metric={data.usage.employees} /><UsageCard label="Automations" metric={data.usage.automations} /><UsageCard label="Voice minutes" metric={data.usage.voiceMinutes} /><UsageCard label="Conversations" metric={data.usage.conversations} /></div><section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-2xl font-black">Included capabilities</h2><div className="mt-5 flex flex-wrap gap-2">{data.plan.features.map((feature) => <span key={feature} className="rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-3 py-1.5 text-xs text-emerald-200">✓ {displayFeature(feature)}</span>)}</div></section></div></main>;
}
function displayFeature(value: string) { return value.replace(/([A-Z])/g, " $1").replace(/^./, (character) => character.toUpperCase()); }
function UsageCard({ label, metric }: { label: string; metric: Metric }) { const value = metric.used == null ? "Not currently tracked" : metric.limit == null ? String(metric.used) : `${metric.used} / ${metric.limit}`; const percent = metric.used != null && metric.limit ? Math.min(100, Math.round(metric.used / metric.limit * 100)) : 0; return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><p className="text-sm text-white/40">{label}</p><p className="mt-3 text-2xl font-black">{value}</p>{metric.limit && <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} /></div>}</div>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
