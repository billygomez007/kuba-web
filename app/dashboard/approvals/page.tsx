"use client";

import { useEffect, useState } from "react";

type Approval = { id: string; employeeId: string | null; channel: string; recipient: string; message: string; status: string; createdAt: string };

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const response = await fetch("/api/action-approvals", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to load approvals.");
    else setApprovals(data.approvals || []);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function decide(id: string, decision: "approved" | "rejected") {
    const response = await fetch(`/api/action-approvals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) });
    if (response.ok) await load();
    else { const data = await response.json(); setError(data.error || "Unable to decide approval."); }
  }

  async function execute(id: string) {
    const response = await fetch(`/api/action-approvals/${id}/execute`, { method: "POST" });
    const data = await response.json();
    if (response.ok) await load(); else setError(data.error || "Unable to execute approved action.");
  }

  return <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-5xl"><header><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-300/70">Human oversight</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Approval Center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Review executable customer communication actions and their decision history for the selected business.</p></header>{error && <p className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-3 text-sm text-red-200">{error}</p>}<section className="mt-8 space-y-4">{approvals.length ? approvals.map((approval) => <article key={approval.id} className="rounded-3xl border border-amber-400/15 bg-amber-400/[0.03] p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-300">{approval.channel} · {approval.employeeId ? "AI requested" : "Human/system requested"}</p><h2 className="mt-2 text-xl font-black">Customer communication action</h2><p className="mt-2 text-sm text-white/60">To: {approval.recipient}</p><p className="mt-1 text-xs text-white/30">Requested {new Date(approval.createdAt).toLocaleString()}</p></div><span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[10px] font-bold uppercase text-amber-300">{approval.status}</span></div><p className="mt-5 rounded-2xl bg-black/20 p-4 text-sm leading-6 text-white/70">{approval.message}</p><div className="mt-5 flex flex-wrap gap-3">{approval.status === "pending" && <><button type="button" onClick={() => void decide(approval.id, "approved")} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-black">Approve</button><button type="button" onClick={() => void decide(approval.id, "rejected")} className="rounded-xl border border-red-400/20 bg-red-400/[0.06] px-4 py-2.5 text-sm font-bold text-red-300">Reject</button></>}{approval.status === "approved" && <button type="button" onClick={() => void execute(approval.id)} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black">Execute approved action</button>}</div></article>) : <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center"><p className="text-lg font-bold">No approvals recorded</p><p className="mt-2 text-sm text-white/35">AI actions requiring human review will appear here.</p></div>}</section></div></main>;
}
