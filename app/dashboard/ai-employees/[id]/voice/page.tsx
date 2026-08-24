"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Provider = { id: string; name: string; status: "available" | "planned" };
type Config = { enabled: boolean; phoneNumber: string; callDirection: "inbound" | "outbound" | "both"; provider: string; voiceModel: string; language: string; accent: string; speakingStyle: string; tone: string; speed: number; workingHours: string; maxDailyCalls: number; maxCallDurationMinutes: number; allowedCallTypes: string[]; callPermissions: string[]; humanTransferRules: string[]; transferDestination: string; automationEvents: string[] };
type Employee = { name: string; type: string; status: string };

const permissions = ["Answer calls", "Provide information", "Capture leads", "Schedule appointments", "Send follow-ups"];
const transferRules = ["Customer requests a human", "AI confidence is low", "Complaint detected", "Payment issue", "Sensitive request"];
const callTypes = ["Customer enquiries", "Appointments", "Sales calls", "Support callbacks"];
const voiceEvents = ["call.started", "call.completed", "call.missed", "customer.requested_callback", "call.escalated"];

export default function EmployeeVoicePage() {
  const { id } = useParams<{ id: string }>();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/ai-employees/${id}/voice`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load voice capability.");
        if (!cancelled) { setEmployee(data.employee); setProviders(data.providers || []); setConfig(data.config); }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load voice capability.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  function update(patch: Partial<Config>) { setConfig((current) => current ? { ...current, ...patch } : current); }
  function toggle(key: "callPermissions" | "humanTransferRules" | "allowedCallTypes" | "automationEvents", value: string) { if (!config) return; update({ [key]: config[key].includes(value) ? config[key].filter((item) => item !== value) : [...config[key], value] }); }

  async function save() {
    if (!config) return;
    setSaving(true); setMessage(""); setError("");
    const response = await fetch(`/api/ai-employees/${id}/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Unable to save voice capability."); else { setConfig(data.config); setMessage("Voice capability settings saved."); }
    setSaving(false);
  }

  if (error && !employee) return <State message={error} error />;
  if (!employee || !config) return <State message="Loading voice capability..." />;

  return <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-6xl"><Link href={`/dashboard/ai-employees/${id}`} className="text-xs font-semibold text-white/40 hover:text-cyan-300">← {employee.name}</Link><header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Employee communication capability</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Enable Voice for {employee.name}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Voice uses the same employee identity, Business Brain, permissions, and workflows as every other channel.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{saving ? "Saving..." : "Save voice settings"}</button></header>{message && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}<section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-cyan-300/70">Voice capability</p><h2 className="mt-2 text-2xl font-black">{config.enabled ? "Enabled" : "Disabled"}</h2><p className="mt-2 text-sm text-white/40">This controls the channel capability for this employee, not a separate agent.</p></div><button type="button" onClick={() => update({ enabled: !config.enabled })} className={`relative h-8 w-14 rounded-full transition ${config.enabled ? "bg-cyan-400" : "bg-white/15"}`} aria-label="Toggle Voice capability"><span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${config.enabled ? "left-7" : "left-1"}`} /></button></div></section><div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Configuration</p><h2 className="mt-2 text-2xl font-black">Voice transport</h2><div className="mt-6 space-y-5"><Field label="Phone number" value={config.phoneNumber} onChange={(value) => update({ phoneNumber: value })} placeholder="+233..." /><label><span className="text-sm font-semibold text-white/70">Voice provider</span><select value={config.provider} onChange={(event) => update({ provider: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70"><option value="">Select provider</option>{providers.map((provider) => <option key={provider.id} value={provider.id} disabled={provider.status === "planned"}>{provider.name}{provider.status === "planned" ? " (planned)" : ""}</option>)}</select></label><Field label="Voice model" value={config.voiceModel} onChange={(value) => update({ voiceModel: value })} placeholder="Configured by provider" /><Field label="Language" value={config.language} onChange={(value) => update({ language: value })} /><Field label="Speaking style" value={config.speakingStyle} onChange={(value) => update({ speakingStyle: value })} /></div></section><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300/70">Call operations</p><h2 className="mt-2 text-2xl font-black">What Voice can do</h2><p className="mt-2 text-sm text-white/40">These controls prepare call permissions while the provider transport is being connected.</p><div className="mt-5 space-y-2">{permissions.map((item) => <button key={item} type="button" onClick={() => toggle("callPermissions", item)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm ${config.callPermissions.includes(item) ? "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-100" : "border-white/[0.08] bg-black/20 text-white/45"}`}><span className="text-emerald-300">{config.callPermissions.includes(item) ? "✓" : "○"}</span>{item}</button>)}</div><label className="mt-6 block"><span className="text-sm font-semibold text-white/70">Working hours</span><select value={config.workingHours} onChange={(event) => update({ workingHours: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70"><option>Business hours</option><option>Always available</option><option>Custom schedule</option></select></label></section></div><section className="mt-6 rounded-3xl border border-amber-300/15 bg-amber-300/[0.03] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/70">Human handoff</p><h2 className="mt-2 text-2xl font-black">Transfer rules</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{transferRules.map((item) => <button key={item} type="button" onClick={() => toggle("humanTransferRules", item)} className={`rounded-xl border p-3 text-left text-sm ${config.humanTransferRules.includes(item) ? "border-amber-300/30 bg-amber-300/[0.07] text-amber-100" : "border-white/[0.08] bg-black/20 text-white/50"}`}><span className="mr-2">{config.humanTransferRules.includes(item) ? "✓" : "○"}</span>{item}</button>)}</div><p className="mt-5 text-xs leading-5 text-white/35">Escalations use existing conversations, routing, handoffs, approvals, and audit activity. Voice does not create a separate CRM.</p></section></div></main>;
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }