"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTime, formatTime } from "@/lib/localization/format";

type Appointment = {
  id: string; title: string; description: string | null; status: string; appointmentType: string; meetingMode: string;
  location: string | null; meetingUrl: string | null; startAt: string; endAt: string; timezone: string;
  customerId: string | null; customerName: string | null; branchName: string | null; assigneeName: string | null;
  cancellationReason: string | null; confirmedAt: string | null; completedAt: string | null; cancelledAt: string | null; noShowAt: string | null;
};

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export default function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [reschedule, setReschedule] = useState({ startAt: "", endAt: "" });

  async function load(appointmentId: string) {
    const response = await fetch(`/api/appointments/${encodeURIComponent(appointmentId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load appointment.");
    setAppointment(data.appointment);
    setReschedule({ startAt: toLocalInput(data.appointment.startAt), endAt: toLocalInput(data.appointment.endAt) });
  }

  useEffect(() => { void params.then(({ id: paramId }) => { setId(paramId); return load(paramId); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load appointment.")); }, [params]);

  async function patch(body: Record<string, string>) {
    if (!id) return;
    setActionError("");
    const response = await fetch(`/api/appointments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setActionError(data.error || "Unable to update appointment."); return; }
    setRescheduleOpen(false);
    await load(id);
  }

  async function cancel() {
    const reason = window.prompt("Cancellation reason (optional):") || "";
    await patch({ status: "cancelled", cancellationReason: reason });
  }

  if (error || !appointment) return <main className="min-h-screen bg-[#050507] px-6 py-12 text-white"><div className="mx-auto max-w-4xl">{error ? <p className="text-red-200">{error}</p> : <p className="text-white/40">Loading appointment...</p>}</div></main>;

  const isTerminal = ["completed", "cancelled", "no_show"].includes(appointment.status);

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-4xl">
        <Link href="/dashboard/appointments" className="text-sm text-cyan-300">Appointments</Link>
        <header className="mt-6 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">{appointment.appointmentType}</p>
            <h1 className="mt-2 text-3xl font-black">{appointment.title}</h1>
            <p className="mt-2 text-sm text-white/40">{formatDateTime(new Date(appointment.startAt), appointment.timezone)} — {formatTime(new Date(appointment.endAt), appointment.timezone)} ({appointment.timezone})</p>
          </div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase text-white/60">{appointment.status.replace("_", " ")}</span>
        </header>

        {actionError && <p role="alert" className="mt-6 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-200">{actionError}</p>}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <DetailField label="Customer" value={!appointment.customerId ? appointment.customerName || "Unlinked" : undefined} link={appointment.customerId ? { href: `/dashboard/customers/${appointment.customerId}`, label: appointment.customerName || "Open customer" } : undefined} />
          <DetailField label="Assignee" value={appointment.assigneeName || "Unassigned"} />
          <DetailField label="Branch" value={appointment.branchName || "—"} />
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <DetailField label="Meeting mode" value={appointment.meetingMode.replace("_", " ")} />
          <DetailField label="Location" value={appointment.location || "—"} />
          <DetailField label="Meeting link" value={appointment.meetingUrl || "—"} />
        </section>

        {appointment.description && (
          <section className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wider text-white/30">Notes</p>
            <p className="mt-3 whitespace-pre-wrap text-base leading-7 text-white/70">{appointment.description}</p>
          </section>
        )}

        {appointment.status === "cancelled" && appointment.cancellationReason && (
          <div className="mt-8 rounded-2xl border border-red-300/15 bg-red-300/[0.04] p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-red-300/70">Cancellation reason</p>
            <p className="mt-2 text-sm leading-6 text-white/70">{appointment.cancellationReason}</p>
          </div>
        )}

        {!isTerminal && (
          <section className="mt-8 flex flex-wrap gap-3">
            {appointment.status === "scheduled" && <button type="button" onClick={() => void patch({ status: "confirmed" })} className="rounded-lg bg-cyan-400/10 px-4 py-2.5 text-xs font-bold text-cyan-200">Confirm</button>}
            {appointment.status === "confirmed" && <button type="button" onClick={() => void patch({ status: "completed" })} className="rounded-lg bg-emerald-400/10 px-4 py-2.5 text-xs font-bold text-emerald-300">Mark completed</button>}
            {appointment.status === "confirmed" && <button type="button" onClick={() => void patch({ status: "no_show" })} className="rounded-lg bg-amber-400/10 px-4 py-2.5 text-xs font-bold text-amber-300">Mark no-show</button>}
            <button type="button" onClick={() => setRescheduleOpen((value) => !value)} className="rounded-lg bg-white/[0.06] px-4 py-2.5 text-xs font-bold text-white/70">{rescheduleOpen ? "Close reschedule" : "Reschedule"}</button>
            <button type="button" onClick={() => void cancel()} className="rounded-lg bg-red-400/10 px-4 py-2.5 text-xs font-bold text-red-300">Cancel</button>
          </section>
        )}

        {rescheduleOpen && !isTerminal && (
          <form onSubmit={(event) => { event.preventDefault(); void patch({ startAt: new Date(reschedule.startAt).toISOString(), endAt: new Date(reschedule.endAt).toISOString() }); }} className="mt-6 grid gap-4 rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6 sm:grid-cols-2">
            <label><span className="text-xs font-bold uppercase tracking-wider text-white/40">New start</span><input type="datetime-local" required value={reschedule.startAt} onChange={(event) => setReschedule({ ...reschedule, startAt: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" /></label>
            <label><span className="text-xs font-bold uppercase tracking-wider text-white/40">New end</span><input type="datetime-local" required value={reschedule.endAt} onChange={(event) => setReschedule({ ...reschedule, endAt: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm" /></label>
            <button className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-black sm:col-span-2">Save new time</button>
          </form>
        )}

        {isTerminal && <p className="mt-8 text-sm text-white/35">This appointment is in a terminal state ({appointment.status.replace("_", " ")}) and can no longer be edited.</p>}
      </div>
    </main>
  );
}

function DetailField({ label, value, link }: { label: string; value?: string; link?: { href: string; label: string } }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-white/30">{label}</p>
      {link ? <Link href={link.href} className="mt-2 block text-sm font-bold text-cyan-300">{link.label}</Link> : <p className="mt-2 truncate text-sm font-bold text-white/80">{value}</p>}
    </div>
  );
}
