"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const levels = [
  { id: "assistant", name: "Assistant Mode", description: "Answers questions and suggests actions.", approval: "Business actions require approval." },
  { id: "operator", name: "Operator Mode", description: "Handles customers, leads, tasks, and follow-ups.", approval: "Financial and sensitive changes require approval." },
  { id: "autonomous", name: "Autonomous Mode", description: "Executes approved workflows and manages CRM work.", approval: "High-risk actions require approval." },
];
const groups = {
  "Customer actions": ["Send messages", "Create leads", "Update customer records", "Assign follow-ups"],
  "Sales actions": ["Qualify leads", "Send proposals", "Schedule meetings"],
  "Financial actions": ["Issue refunds", "Apply discounts", "Process payments"],
  "Business actions": ["Update information", "Modify workflows", "Change settings"],
};

export default function EmployeePermissionsPage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<{ name: string; type: string; status: string; supervisionMode: string } | null>(null);
  const [level, setLevel] = useState("assistant");
  const [enabled, setEnabled] = useState<string[]>([]);
  const [approval, setApproval] = useState<string[]>(["Issue refunds", "Apply discounts", "Process payments", "Change settings"]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/ai-employees/${id}/permissions`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { if (!cancelled) setError(data.error || "Unable to load permissions."); return; }
      if (!cancelled) { setEmployee(data.employee); setLevel(data.employee.supervisionMode || "assistant"); }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  function toggle(value: string, values: string[], setter: (next: string[]) => void) { setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]); }

  async function save() {
    setSaving(true); setMessage(""); setError("");
    const response = await fetch(`/api/ai-employees/${id}/permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ autonomyLevel: level, enabledActions: enabled, approvalActions: approval }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to save autonomy settings."); else setMessage("Autonomy settings saved.");
    setSaving(false);
  }

  if (error && !employee) return <State message={error} error />;
  if (!employee) return <State message="Loading autonomy controls..." />;

  return <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-6xl"><Link href={`/dashboard/ai-employees/${id}`} className="text-xs font-semibold text-white/40 hover:text-cyan-300">← {employee.name}</Link><header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Autonomy and approval controls</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">What can {employee.name} do?</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Set the operating boundary for this employee. High-risk actions remain subject to human review.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{saving ? "Saving..." : "Save controls"}</button></header>{message && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}
<section className="mt-8 grid gap-4 lg:grid-cols-3">{levels.map((item) => <button key={item.id} type="button" onClick={() => setLevel(item.id)} className={`rounded-3xl border p-6 text-left transition ${level === item.id ? "border-cyan-300/35 bg-cyan-300/[0.08]" : "border-white/10 bg-white/[0.025] hover:border-white/20"}`}><div className="flex items-center justify-between"><h2 className="text-lg font-black">{item.name}</h2><span className="text-cyan-300">{level === item.id ? "✓" : ""}</span></div><p className="mt-3 text-sm leading-6 text-white/55">{item.description}</p><p className="mt-5 text-xs font-semibold text-amber-200/70">{item.approval}</p></button>)}</section>
<section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Action permissions</p><h2 className="mt-2 text-2xl font-black">Allowed capabilities</h2><p className="mt-2 text-sm text-white/40">These controls prepare granular workflow enforcement. Current runtime permissions remain governed by existing systems.</p><div className="mt-6 grid gap-6 md:grid-cols-2">{Object.entries(groups).map(([group, values]) => <div key={group}><h3 className="text-sm font-bold text-white/75">{group}</h3><div className="mt-3 space-y-2">{values.map((value) => <button key={value} type="button" onClick={() => toggle(value, enabled, setEnabled)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm ${enabled.includes(value) ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-100" : "border-white/[0.08] bg-black/20 text-white/50"}`}><span className="text-emerald-300">{enabled.includes(value) ? "✓" : "○"}</span>{value}</button>)}</div></div>)}</div></section>
<section className="mt-6 rounded-3xl border border-amber-400/15 bg-amber-400/[0.03] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/70">Approval center</p><h2 className="mt-2 text-2xl font-black">Actions requiring review</h2><p className="mt-2 text-sm leading-6 text-white/40">Select actions that should pause for a human decision in future workflow enforcement.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{["External messages", "Issue refunds", "Apply discounts", "Process payments", "Customer data changes", "Change settings"].map((value) => <button key={value} type="button" onClick={() => toggle(value, approval, setApproval)} className={`rounded-xl border p-3 text-left text-sm ${approval.includes(value) ? "border-amber-300/30 bg-amber-300/[0.07] text-amber-100" : "border-white/[0.08] bg-black/20 text-white/50"}`}><span className="mr-2">{approval.includes(value) ? "✓" : "○"}</span>{value}</button>)}</div></section></div></main>;
}

function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }