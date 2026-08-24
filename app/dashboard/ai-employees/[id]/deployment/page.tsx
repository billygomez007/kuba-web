"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Channel = { id: string; name: string; status: "connected" | "not_connected" | "requires_setup" };
type TeamMember = { userId: string; name: string; email: string };
type Employee = { id: string; name: string; type: string; status: string };
type Settings = { workingHours: string | null; escalationRules: string | null; responsibilities: string | null; communicationStyle: string | null } | null;
type DeploymentData = { employee: Employee; settings: Settings; channels: Channel[]; timezone: string; teamMembers: TeamMember[] };

const responsibilities = ["Reception", "Sales", "Customer Support", "Appointments", "Marketing"];
const escalationOptions = ["Customer requests human", "AI confidence is low", "Complaint detected", "Payment issue", "Sensitive request"];
const permissionOptions = ["Can create leads", "Can send messages", "Can update CRM", "Can schedule appointments", "Can access customer information"];

export default function EmployeeDeploymentPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DeploymentData | null>(null);
  const [selectedResponsibilities, setSelectedResponsibilities] = useState<string[]>([]);
  const [escalationRules, setEscalationRules] = useState<string[]>(escalationOptions);
  const [permissions, setPermissions] = useState<string[]>(permissionOptions);
  const [workingHours, setWorkingHours] = useState("business");
  const [customSchedule, setCustomSchedule] = useState("");
  const [communicationStyle, setCommunicationStyle] = useState("Professional");
  const [supervisorUserId, setSupervisorUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadDeployment() {
      try {
        const response = await fetch(`/api/ai-employees/${id}/deployment`, { cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load deployment settings.");
        if (!cancelled) {
          setData(result);
          setCommunicationStyle(result.settings?.communicationStyle || "Professional");
          setEscalationRules(result.settings?.escalationRules?.split("\n").filter(Boolean) || escalationOptions);
          setSelectedResponsibilities(result.settings?.responsibilities?.split("\n").filter(Boolean) || []);
          setWorkingHours(result.settings?.workingHours || "business");
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load deployment settings.");
      }
    }
    void loadDeployment();
    return () => { cancelled = true; };
  }, [id]);

  function toggle(value: string, values: string[], setter: (next: string[]) => void) {
    setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    const response = await fetch(`/api/ai-employees/${id}/deployment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responsibilities: selectedResponsibilities,
        escalationRules,
        workingHours: workingHours === "custom" ? customSchedule : workingHours,
        communicationStyle,
        supervisorUserId,
        permissions,
      }),
    });
    const result = await response.json();
    if (!response.ok) setError(result.error || "Unable to save deployment settings.");
    else setMessage("Deployment settings saved.");
    setSaving(false);
  }

  if (error && !data) return <State message={error} error />;
  if (!data) return <State message="Loading deployment center..." />;

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-7 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1450px]">
        <Link href={`/dashboard/ai-employees/${id}`} className="text-xs font-semibold text-white/40 hover:text-cyan-300">← {data.employee.name}</Link>
        <header className="mt-5 flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">AI Employee Deployment Center</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Where {data.employee.name} works</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Configure channels, responsibilities, working hours, and escalation behavior for this employee.</p></div><button type="button" onClick={() => void save()} disabled={saving} className="rounded-xl bg-cyan-400 px-5 py-3 text-sm font-bold text-black disabled:opacity-50">{saving ? "Saving..." : "Save deployment"}</button></header>
        {message && <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200">{message}</p>}
        {error && <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-3 text-sm text-red-200">{error}</p>}

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><SectionTitle eyebrow="Channel assignment" title="Connected customer channels" description="Choose where this employee can work. Channel connection status reflects your existing integrations." /><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{data.channels.map((channel) => <div key={channel.id} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><p className="font-bold">{channel.name}</p><span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase ${channel.status === "connected" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : channel.status === "requires_setup" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : "border-white/10 bg-white/[0.04] text-white/35"}`}>{channel.status.replaceAll("_", " ")}</span></div><p className="mt-2 text-xs leading-5 text-white/35">{channel.id === "voice" ? "Voice support is prepared for a future connection." : channel.status === "connected" ? "Available to this business." : "Connect this channel to enable deployment."}</p></div>)}</div></section>

        <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><SectionTitle eyebrow="Employee workspace" title="Primary responsibilities" description="Set the business areas this employee should focus on." /><ChoiceList values={responsibilities} selected={selectedResponsibilities} onToggle={(value) => toggle(value, selectedResponsibilities, setSelectedResponsibilities)} /><div className="mt-7"><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300/70">Human escalation contacts</p><select value={supervisorUserId} onChange={(event) => setSupervisorUserId(event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70"><option value="">Select escalation contact</option>{data.teamMembers.map((member) => <option key={member.userId} value={member.userId}>{member.name} · {member.email}</option>)}</select></div></section>

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><SectionTitle eyebrow="Working hours" title="When this employee works" description={`Business timezone: ${data.timezone}`} /><div className="mt-6 space-y-3">{[["business", "Business hours"], ["always", "Always available"], ["custom", "Custom schedule"]].map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 ${workingHours === value ? "border-cyan-300/30 bg-cyan-300/[0.07]" : "border-white/[0.08] bg-black/20"}`}><input type="radio" name="hours" value={value} checked={workingHours === value} onChange={(event) => setWorkingHours(event.target.value)} className="accent-cyan-400" /><span className="text-sm font-semibold text-white/70">{label}</span></label>)}</div>{workingHours === "custom" && <input value={customSchedule} onChange={(event) => setCustomSchedule(event.target.value)} placeholder="Example: Mon-Fri, 09:00-17:00" className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-cyan-300/40" />}</section></div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2"><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><SectionTitle eyebrow="Escalation rules" title="When should AI transfer?" description="These rules are saved as employee operating guidance." /><ChoiceList values={escalationOptions} selected={escalationRules} onToggle={(value) => toggle(value, escalationRules, setEscalationRules)} /></section><section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><SectionTitle eyebrow="Permission control" title="What can this employee do?" description="Control preparation for future workflow enforcement." /><ChoiceList values={permissionOptions} selected={permissions} onToggle={(value) => toggle(value, permissions, setPermissions)} /></section></div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><SectionTitle eyebrow="Communication" title="Employee communication style" description="This setting is persisted through the existing employee configuration." /><div className="mt-5 flex flex-wrap gap-3">{["Professional", "Friendly", "Formal", "Conversational"].map((style) => <button key={style} type="button" onClick={() => setCommunicationStyle(style)} className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${communicationStyle === style ? "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-200" : "border-white/10 bg-black/20 text-white/45"}`}>{style}</button>)}</div></section>
      </div>
    </main>
  );
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/65">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2><p className="mt-2 text-sm leading-6 text-white/40">{description}</p></div>; }
function ChoiceList({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) { return <div className="mt-6 grid gap-3 sm:grid-cols-2">{values.map((value) => <button key={value} type="button" onClick={() => onToggle(value)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left text-sm ${selected.includes(value) ? "border-cyan-300/30 bg-cyan-300/[0.07] text-cyan-100" : "border-white/[0.08] bg-black/20 text-white/50"}`}><span className="text-emerald-300">{selected.includes(value) ? "✓" : "○"}</span>{value}</button>)}</div>; }
function Status({ status }: { status: string }) { return <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-300">{status}</span>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
