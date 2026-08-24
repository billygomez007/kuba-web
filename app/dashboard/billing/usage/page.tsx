"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { used: number | null; limit: number | null };
type Usage = { employees: Item; conversations: Item; messages: Item; automations: Item; automationRuns: Item; voiceMinutes: Item; voiceCalls: Item; knowledgeSources: Item; integrations: Item };

export default function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/billing/usage", { cache: "no-store" })
        .then(async (response) => {
          const data = await response.json();
          if (!active) return;
          if (response.ok) setUsage(data.usage);
          else setError(data.error || "Unable to load usage.");
        })
        .catch(() => {
          if (!active) return;
          setError("Unable to load usage.");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  if (!usage) return <State message={error || "Loading usage center..."} error={Boolean(error)} />;
  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-6xl"><Link href="/dashboard/billing" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Billing</Link><h1 className="mt-5 text-4xl font-black">Usage center</h1><p className="mt-3 text-sm text-white/40">Current-period usage derived from operational records.</p><div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(usage).map(([key, item]) => <UsageRow key={key} label={key.replace(/([A-Z])/g, " $1")} item={normalizeMetric(item)} />)}</div></div></main>;
}
function normalizeMetric(value: unknown): Item { if (typeof value === "number") return { used: value, limit: null }; if (typeof value !== "object" || !value) return { used: null, limit: null }; const candidate = value as { used?: unknown; limit?: unknown }; return { used: typeof candidate.used === "number" ? candidate.used : null, limit: typeof candidate.limit === "number" ? candidate.limit : null }; }
function UsageRow({ label, item }: { label: string; item: Item }) { const tracked = item.used !== null; const percent = tracked && item.limit ? Math.min(100, Math.round(item.used! / item.limit * 100)) : 0; return <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"><div className="flex items-center justify-between gap-3"><p className="text-sm capitalize text-white/60">{label}</p><p className="text-sm font-bold text-cyan-200">{!tracked ? "Not currently tracked" : item.limit === null ? item.used : `${item.used} / ${item.limit}`}</p></div>{item.limit && <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{ width: `${percent}%` }} /></div>}</section>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
