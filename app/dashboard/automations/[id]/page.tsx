"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Workflow = { type: string; employeeType?: string; title?: string; message?: string; status?: string };
type Run = { id: string; triggerType: string; status: string; error: string | null; startedAt: string; completedAt: string | null };
type Detail = { automation: { name: string; description: string | null; trigger: string; conditions: Workflow[]; actions: Workflow[]; status: string }; runs: Run[]; performance: { totalRuns: number; completedRuns: number; failedRuns: number; successRate: number | null; lastRun: string | null } };

export default function AutomationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/automations/${id}`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load automation.");
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load automation.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  if (error) return <State message={error} error />;
  if (!data) return <State message="Loading automation details..." />;
  const { automation, performance, runs } = data;

  return <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12"><div className="mx-auto max-w-6xl"><Link href="/dashboard/automations" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Automations</Link><header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Automation detail</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="text-4xl font-black tracking-[-0.04em]">{automation.name}</h1><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-bold uppercase text-emerald-300">{automation.status}</span></div><p className="mt-3 text-sm text-white/40">{automation.description || "No description"}</p></div><p className="text-xs text-white/30">Last run: {formatDate(performance.lastRun)}</p></header><section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Total runs" value={performance.totalRuns} /><Metric label="Successful" value={performance.completedRuns} /><Metric label="Failed" value={performance.failedRuns} /><Metric label="Success rate" value={performance.successRate == null ? "Not tracked" : `${performance.successRate}%`} /></section><section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Workflow visualization</p><h2 className="mt-2 text-2xl font-black">How this automation runs</h2><div className="mt-6 flex flex-col items-stretch gap-3 md:flex-row md:items-center"><Step label="WHEN" value={automation.trigger} /><span className="hidden text-xl text-cyan-300/50 md:block">→</span><Step label="THEN" value={`${automation.actions.length} action${automation.actions.length === 1 ? "" : "s"}`} /><span className="hidden text-xl text-cyan-300/50 md:block">→</span><Step label="CONDITIONS" value={`${automation.conditions.length} optional condition${automation.conditions.length === 1 ? "" : "s"}`} /></div><div className="mt-6 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-white/30">Actions</p><div className="mt-3 space-y-2">{automation.actions.map((action, index) => <div key={index} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-white/65">{action.type.replaceAll("_", " ")}{action.employeeType ? ` · ${action.employeeType}` : ""}</div>)}</div></div><div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4"><p className="text-xs uppercase tracking-wider text-white/30">Conditions</p><div className="mt-3 space-y-2">{automation.conditions.length ? automation.conditions.map((condition, index) => <div key={index} className="rounded-xl bg-white/[0.04] px-3 py-2.5 text-sm text-white/65">{condition.type || "condition"}</div>) : <p className="text-sm text-white/35">Runs whenever the trigger is received.</p>}</div></div></div></section><section className="mt-7 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Execution history</p><h2 className="mt-2 text-2xl font-black">Recent runs</h2><div className="mt-6 space-y-3">{runs.length ? runs.map((run) => <div key={run.id} className="flex flex-col justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-white/75">{run.triggerType}</p><p className="mt-1 text-xs text-white/35">Started {formatDate(run.startedAt)} · Completed {formatDate(run.completedAt)}</p>{run.error && <p className="mt-2 text-xs text-red-300">{run.error}</p>}</div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${run.status === "completed" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-red-400/20 bg-red-400/10 text-red-300"}`}>{run.status}</span></div>) : <p className="text-sm text-white/35">No executions recorded yet.</p>}</div></section></div></main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Step({ label, value }: { label: string; value: string }) { return <div className="flex-1 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.05] p-5"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300/60">{label}</p><p className="mt-2 text-sm font-bold capitalize text-white/75">{value.replaceAll("_", " ")}</p></div>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
function formatDate(value: string | null) { if (!value) return "Not run"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString(); }
