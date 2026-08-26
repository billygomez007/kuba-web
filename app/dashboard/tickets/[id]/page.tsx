"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Ticket = { id: string; ticketReference: string; subject: string; description: string; conversationId: string | null; customerId: string | null; customerName: string | null; branchName: string | null; assigneeName: string | null; status: string; priority: string; resolutionSummary: string | null; openedAt: string; resolvedAt: string | null; closedAt: string | null; updatedAt: string };

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  async function load(ticketId: string) {
    const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load ticket.");
    setTicket(data.ticket);
  }

  useEffect(() => { void params.then(({ id: paramId }) => { setId(paramId); return load(paramId); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load ticket.")); }, [params]);

  async function update(body: Record<string, string>) {
    if (!id) return;
    setActionError("");
    const response = await fetch(`/api/tickets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) setActionError(data.error || "Unable to update ticket.");
    else await load(id);
  }

  if (error || !ticket) return <main className="min-h-screen bg-[#050507] px-6 py-12 text-white"><div className="mx-auto max-w-4xl">{error ? <p className="text-red-200">{error}</p> : <p className="text-white/40">Loading ticket...</p>}</div></main>;

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/tickets" className="text-sm text-cyan-300">Tickets</Link>
        <header className="mt-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">{ticket.ticketReference}</p>
            <h1 className="mt-2 text-3xl font-black">{ticket.subject}</h1>
            <p className="mt-2 text-sm text-white/40">Opened {new Date(ticket.openedAt).toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase text-white/60">{ticket.status}</span>
            <span className="rounded-full border border-amber-300/20 px-3 py-1 text-xs uppercase text-amber-200">{ticket.priority}</span>
          </div>
        </header>

        {actionError && <p role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">{actionError}</p>}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <DetailField label="Customer" value={ticket.customerId ? undefined : ticket.customerName || "Unlinked"} link={ticket.customerId ? { href: `/dashboard/customers/${ticket.customerId}`, label: ticket.customerName || "Open customer" } : undefined} />
          <DetailField label="Assignee" value={ticket.assigneeName || "Unassigned"} />
          <DetailField label="Branch" value={ticket.branchName || "—"} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <DetailField label="Opened" value={new Date(ticket.openedAt).toLocaleString()} />
          <DetailField label="Resolved" value={ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString() : "—"} />
          <DetailField label="Closed" value={ticket.closedAt ? new Date(ticket.closedAt).toLocaleString() : "—"} />
        </section>

        <section className="mt-8 space-y-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/30">Issue</p>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-white/70">{ticket.description}</p>
          </div>

          {ticket.resolutionSummary && (
            <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300/70">Resolution</p>
              <p className="mt-2 text-sm leading-6 text-white/70">{ticket.resolutionSummary}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {ticket.status === "open" && <button type="button" onClick={() => void update({ status: "in_progress" })} className="rounded-lg bg-cyan-400/10 px-4 py-2.5 text-xs font-bold text-cyan-200">Start work</button>}
            {["in_progress", "waiting_customer", "waiting_internal"].includes(ticket.status) && <button type="button" onClick={() => void update({ status: "resolved", resolutionSummary: "Resolved by support team." })} className="rounded-lg bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-300">Resolve</button>}
            {ticket.status === "resolved" && <button type="button" onClick={() => void update({ status: "closed" })} className="rounded-lg bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white/70">Close</button>}
            {ticket.status === "closed" && <button type="button" onClick={() => void update({ status: "open" })} className="rounded-lg bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-300">Reopen</button>}
          </div>

          <div className="flex flex-wrap gap-4 border-t border-white/10 pt-6 text-sm">
            {ticket.customerId && <Link href={`/dashboard/customers/${ticket.customerId}`} className="text-cyan-300">Open customer</Link>}
            {ticket.conversationId && <Link href={`/dashboard/inbox?conversation=${encodeURIComponent(ticket.conversationId)}`} className="text-cyan-300">Open conversation</Link>}
          </div>
        </section>
      </div>
    </main>
  );
}

function DetailField({ label, value, link }: { label: string; value?: string; link?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-white/30">{label}</p>
      {link ? <Link href={link.href} className="mt-2 block text-sm font-bold text-cyan-300">{link.label}</Link> : <p className="mt-2 text-sm font-bold text-white/80">{value}</p>}
    </div>
  );
}
