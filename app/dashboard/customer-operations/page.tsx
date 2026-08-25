"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Operations = { metrics: { totalConversations: number; activeConversations: number; conversationsToday: number; leads: number; followUps: number; tasksCompleted: number; pendingApprovals: number }; handoffs: Array<{ status: string }> };

export default function CustomerOperationsPage() {
  const [operations, setOperations] = useState<Operations | null>(null);
  const [customers, setCustomers] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => { void Promise.all([fetch("/api/inbox/workspace", { cache: "no-store" }), fetch("/api/customers", { cache: "no-store" })]).then(async ([workspaceResponse, customerResponse]) => {
    const workspace = await workspaceResponse.json(); const customerData = await customerResponse.json();
    if (!workspaceResponse.ok || !customerResponse.ok) throw new Error(workspace.error || customerData.error || "Unable to load customer operations.");
    setOperations(workspace); setCustomers(customerData.customers?.length || 0);
  }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load customer operations.")); }, []);
  const cards = [
    ["Total customers", customers, "/dashboard/customers"], ["Active leads", operations?.metrics.leads ?? "…", "/dashboard/sales"],
    ["Open conversations", operations?.metrics.activeConversations ?? "…", "/dashboard/conversations"], ["Follow-ups due", operations?.metrics.followUps ?? "…", "/dashboard/follow-ups"],
    ["Pending handoffs", operations?.handoffs.filter((item) => item.status === "pending").length ?? "…", "/dashboard/handoffs"], ["Conversations today", operations?.metrics.conversationsToday ?? "…", "/dashboard/inbox"],
  ] as const;
  return <main className="min-h-screen bg-[#050507] px-6 py-10 text-white lg:px-10 lg:py-14"><div className="mx-auto max-w-[1500px]"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Customer Operations</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Operations overview</h1><p className="mt-3 text-sm text-white/40">Verified workload for the currently selected business.</p>{error ? <p className="mt-8 rounded-2xl border border-red-400/20 p-5 text-red-200">{error}</p> : <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map(([label, value, href]) => <Link key={label} href={href} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-cyan-300/20 hover:bg-white/[0.04]"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/30">{label}</p><p className="mt-4 text-3xl font-black text-cyan-100">{value}</p><p className="mt-4 text-xs text-white/30">Open workspace →</p></Link>)}</section>}<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-7"><h2 className="text-xl font-black">Operational truth</h2><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">These totals come from customers, leads, conversations, follow-ups, and handoffs stored for the selected business. CSAT, NPS, revenue, and unread counts are intentionally omitted because no reliable source currently exists.</p></section></div></main>;
}
