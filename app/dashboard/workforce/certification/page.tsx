"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Readiness = {
  employee: { id: string; name: string; type: string; department: string; status: string };
  scores: { knowledge: number | null; training: number | null; configuration: number | null; permissions: number | null; overall: number | null };
  certificationStatus: string;
  checklist: Record<string, boolean>;
  improvements: string[];
  simulationCount: number;
  lastSimulationScore: number | null;
};
type Data = { readiness: Readiness[] };

const checklistLabels: Record<string, string> = {
  businessKnowledge: "Business Brain connected",
  knowledgeSources: "Knowledge sources available",
  responsibilities: "Responsibilities defined",
  communicationStyle: "Communication style configured",
  simulationCompleted: "Simulation completed",
  simulationAcceptable: "Simulation performance acceptable",
  approvalRules: "Approval rules configured",
  humanEscalation: "Human escalation configured",
  deploymentSettings: "Deployment settings completed",
};

export default function CertificationPage() {
  const [data, setData] = useState<Data | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("All");
  const [error, setError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/workforce/certification", { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load certification readiness.");
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load certification readiness.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const departments = useMemo(() => ["All", ...new Set((data?.readiness || []).map((item) => item.employee.department))], [data]);
  const rows = useMemo(() => (data?.readiness || []).filter((item) => filter === "All" || item.employee.department === filter), [data, filter]);
  const selected = rows.find((item) => item.employee.id === selectedId) || rows[0];

  if (error) return <State message={error} error />;
  if (!data) return <State message="Loading certification center..." />;

  const allImprovements = [...new Set(rows.flatMap((item) => item.improvements))];

  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-[1550px]"><header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">AI Workforce Governance</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Certification Center</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Evaluate every AI employee before production deployment. Readiness is derived from the current business context, configuration, simulations, and controls.</p></div><Link href="/dashboard/workforce/simulator" className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.1]">Open simulator</Link></header><div className="mt-8 flex flex-wrap gap-2">{departments.map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${filter === item ? "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-200" : "border-white/10 text-white/40"}`}>{item}</button>)}</div><section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-sm"><thead><tr className="border-b border-white/10 text-[10px] uppercase tracking-wider text-white/30"><th className="px-4 py-4">Employee</th><th className="px-4 py-4">Department</th><th className="px-4 py-4">Status</th><th className="px-4 py-4">Knowledge</th><th className="px-4 py-4">Training</th><th className="px-4 py-4">Configuration</th><th className="px-4 py-4">Permissions</th><th className="px-4 py-4">Overall</th><th className="px-4 py-4">Certification</th></tr></thead><tbody>{rows.length ? rows.map((item) => <tr key={item.employee.id} onClick={() => setSelectedId(item.employee.id)} className={`cursor-pointer border-b border-white/[0.06] text-white/65 hover:bg-white/[0.04] ${selected?.employee.id === item.employee.id ? "bg-cyan-300/[0.05]" : ""}`}><td className="px-4 py-4"><Link href={`/dashboard/ai-employees/${item.employee.id}`} onClick={(event) => event.stopPropagation()} className="font-bold text-white/85 hover:text-cyan-300">{item.employee.name}</Link><span className="mt-1 block text-xs capitalize text-white/30">{item.employee.type.replaceAll("-", " ")}</span></td><td className="px-4 py-4 text-xs text-white/40">{item.employee.department}</td><td className="px-4 py-4 text-xs text-emerald-300">{item.employee.status}</td><td className="px-4 py-4">{score(item.scores.knowledge)}</td><td className="px-4 py-4">{score(item.scores.training)}</td><td className="px-4 py-4">{score(item.scores.configuration)}</td><td className="px-4 py-4">{score(item.scores.permissions)}</td><td className="px-4 py-4 font-black text-cyan-300">{score(item.scores.overall)}</td><td className="px-4 py-4"><span className={statusColor(item.certificationStatus)}>{item.certificationStatus}</span></td></tr>) : <tr><td colSpan={9} className="px-4 py-10 text-center text-white/35">No AI employees found.</td></tr>}</tbody></table></div></section>{selected && <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Certification checklist</p><h2 className="mt-2 text-2xl font-black">{selected.employee.name}</h2><p className="mt-2 text-sm text-white/40">{selected.simulationCount} simulation{selected.simulationCount === 1 ? "" : "s"} recorded{selected.lastSimulationScore === null ? "" : ` · latest score ${selected.lastSimulationScore}%`}</p></div><span className={statusColor(selected.certificationStatus)}>{selected.certificationStatus}</span></div><div className="mt-6 space-y-3">{Object.entries(selected.checklist).map(([key, complete]) => <div key={key} className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/20 p-3.5"><span className="text-sm text-white/65">{checklistLabels[key]}</span><span className={complete ? "text-emerald-300" : "text-amber-300"}>{complete ? "✓ Complete" : "Missing"}</span></div>)}</div><div className="mt-6 flex flex-wrap gap-3"><button type="button" onClick={() => setReviewMessage("Manager approval is prepared but not persisted until certification storage is introduced.")} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Approve certification</button><button type="button" onClick={() => setReviewMessage("Improvement request is prepared for manager review.")} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] px-4 py-2.5 text-sm font-semibold text-amber-200">Request improvements</button><button type="button" onClick={() => setReviewMessage("Certification rejection is prepared but not persisted.")} className="rounded-xl border border-red-300/20 bg-red-300/[0.05] px-4 py-2.5 text-sm font-semibold text-red-200">Reject certification</button></div>{reviewMessage && <p className="mt-4 text-xs leading-5 text-white/40">{reviewMessage}</p>}</div><div className="rounded-3xl border border-violet-300/15 bg-violet-300/[0.035] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Improvement center</p><h2 className="mt-2 text-2xl font-black">What needs attention</h2><div className="mt-6 space-y-3">{selected.improvements.length ? selected.improvements.map((item) => <div key={item} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm leading-6 text-white/60">{item}</div>) : <p className="text-sm text-white/35">No improvement gaps detected.</p>}</div></div></section>}<section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Workforce improvement overview</p><h2 className="mt-2 text-2xl font-black">Shared improvement signals</h2><div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">{allImprovements.slice(0, 12).map((item) => <div key={item} className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 text-sm text-white/55">{item}</div>)}</div></section></div></main>;
}

function score(value: number | null) { return value === null ? "Not configured" : `${value}%`; }
function statusColor(value: string) { return value === "Ready for Certification" ? "text-emerald-300" : value === "Testing" ? "text-amber-300" : value === "Training" ? "text-cyan-300" : "text-white/40"; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
