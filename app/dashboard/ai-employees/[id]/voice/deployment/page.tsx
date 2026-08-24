"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Provider = { id: string; name: string; status: string; models?: string[] };
type Config = { enabled: boolean; phoneNumber: string; callDirection: "inbound" | "outbound" | "both"; provider: string; voiceModel: string; language: string; accent: string; speakingStyle: string; tone: string; speed: number; workingHours: string; maxDailyCalls: number; maxCallDurationMinutes: number; allowedCallTypes: string[]; transferDestination: string; humanTransferRules: string[] };
type Data = { employee: { name: string; type: string; status: string }; config: Config; providers: Provider[] };

const purposes = ["Sales", "Support", "Appointments", "Follow-up"];
const transfers = ["Customer requests a human", "AI confidence is low", "Complaint detected", "Payment issue", "Sensitive request"];

export default function VoiceDeploymentPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/ai-employees/${id}/voice`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { if (!cancelled) setError(result.error || "Unable to load deployment center."); return; }
      if (!cancelled) { setData(result); setConfig(result.config); }
    }
    void load();
    return () => { cancelled = true; };
  }, [id]);

  function update(patch: Partial<Config>) { setConfig((current) => current ? { ...current, ...patch } : current); }
  function toggle(key: "allowedCallTypes" | "humanTransferRules", value: string) { if (!config) return; update({ [key]: config[key].includes(value) ? config[key].filter((item) => item !== value) : [...config[key], value] }); }

  async function save() {
    if (!config) return;
    setSaving(true); setMessage(""); setError("");
    const response = await fetch(`/api/ai-employees/${id}/voice`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to save deployment."); else { setConfig(result.config); setMessage("Voice deployment saved. Live calls remain disabled until a provider transport is configured."); }
    setSaving(false);
  }

  if (error && !data) return <State message={error} error />;
  if (!data || !config) return <State message="Loading voice deployment center..." />;

  return <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-6xl"><Link href={`/dashboard/ai-employees/${id}/voice`} className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Voice capability</Link><header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Voice Deployment Center</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Deploy {data.employee.name} to a phone</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Voice remains a channel of this AI employee and uses its existing Business Brain, memory, permissions, handoffs, and conversations.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{saving ? "Saving..." : "Save deployment"}</button></header>{message && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">{message}</p>}{error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}

<section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6 sm:p-8"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-300/70">Deployment status</p><h2 className="mt-2 text-2xl font-black">{config.enabled ? config.phoneNumber ? "Provisioning" : "Not connected" : "Not connected"}</h2><p className="mt-2 text-sm text-white/40">Assigned number, provider, country, and status are kept on this employee capability.</p></div><button type="button" onClick={() => update({ enabled: !config.enabled })} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${config.enabled ? "bg-emerald-400 text-black" : "bg-white/[0.08] text-white/65"}`}>{config.enabled ? "Enabled" : "Enable voice"}</button></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><Field label="Assigned phone number" value={config.phoneNumber} onChange={(value) => update({ phoneNumber: value })} placeholder="+233..." /><label><span className="text-sm font-semibold text-white/70">Provider</span><select value={config.provider} onChange={(event) => update({ provider: event.target.value, voiceModel: "" })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70"><option value="">Select provider</option>{data.providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label><Field label="Country / routing region" value={config.language === "English" ? "Ghana" : config.language} onChange={(value) => update({ language: value === "Ghana" ? "English" : value })} /></div></section>

<div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><Title eyebrow="Call routing" title="How calls reach this employee" /><div className="mt-5 grid gap-3 sm:grid-cols-3">{([["inbound", "Receive calls"], ["outbound", "Make calls"], ["both", "Both directions"]] as const).map(([value, label]) => <button key={value} type="button" onClick={() => update({ callDirection: value })} className={`rounded-2xl border p-4 text-left text-sm font-semibold ${config.callDirection === value ? "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-100" : "border-white/10 bg-black/20 text-white/55"}`}>{label}</button>)}</div><label className="mt-5 block"><span className="text-sm font-semibold text-white/70">Outside business hours</span><select value={config.workingHours} onChange={(event) => update({ workingHours: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70"><option>Business hours</option><option>Always available</option><option>Transfer to human</option></select></label></section><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><Title eyebrow="Provider connection" title="Voice transport" /><div className="mt-5 space-y-4"><label><span className="text-sm font-semibold text-white/70">Voice model</span><select value={config.voiceModel} onChange={(event) => update({ voiceModel: event.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70"><option value="">Provider default</option>{data.providers.find((item) => item.id === config.provider)?.models?.map((model) => <option key={model}>{model}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><Field label="Language" value={config.language} onChange={(value) => update({ language: value })} /><Field label="Accent" value={config.accent} onChange={(value) => update({ accent: value })} /><Field label="Speaking style" value={config.speakingStyle} onChange={(value) => update({ speakingStyle: value })} /><Field label="Tone" value={config.tone} onChange={(value) => update({ tone: value })} /></div></div></section></div>

<div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><Title eyebrow="AI employee limits" title="Allowed call purposes" /><ChoiceList values={purposes} selected={config.allowedCallTypes} onToggle={(value) => toggle("allowedCallTypes", value)} /><div className="mt-5 grid gap-4 sm:grid-cols-2"><NumberField label="Maximum calls per day" value={config.maxDailyCalls} onChange={(value) => update({ maxDailyCalls: value })} /><NumberField label="Maximum duration (minutes)" value={config.maxCallDurationMinutes} onChange={(value) => update({ maxCallDurationMinutes: value })} /></div></section><section className="rounded-3xl border border-amber-300/15 bg-amber-300/[0.03] p-6 sm:p-8"><Title eyebrow="Human transfer" title="Escalation and destination" /><ChoiceList values={transfers} selected={config.humanTransferRules} onToggle={(value) => toggle("humanTransferRules", value)} /><Field label="Transfer destination" value={config.transferDestination} onChange={(value) => update({ transferDestination: value })} /></section></div>
</div></main>;
}

function Title({ eyebrow, title }: { eyebrow: string; title: string }) { return <><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/65">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2></>; }
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /></label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="block"><span className="text-sm font-semibold text-white/70">{label}</span><input type="number" min="1" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" /></label>; }
function ChoiceList({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) { return <div className="mt-5 grid gap-2 sm:grid-cols-2">{values.map((value) => <button key={value} type="button" onClick={() => onToggle(value)} className={`rounded-xl border p-3 text-left text-sm ${selected.includes(value) ? "border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-100" : "border-white/10 bg-black/20 text-white/50"}`}>{selected.includes(value) ? "✓ " : "○ "}{value}</button>)}</div>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
