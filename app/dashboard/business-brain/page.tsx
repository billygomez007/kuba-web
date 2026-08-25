"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Source = {
  id: string;
  name: string;
  originalName: string;
  fileType: string;
  status: string;
  updatedAt: string;
  employeeId: string | null;
};

type Employee = {
  id: string;
  name: string;
  type: string;
  status: string;
  access: string[];
  dedicatedSources: string[];
};

type Brain = {
  profile: Record<string, string | string[] | null>;
  sources: Source[];
  employees: Employee[];
  memory: Record<string, string>;
  rules: Record<string, string>;
};

const profileFields: Array<[string, keyof Brain["profile"]]> = [
  ["Company name", "companyName"],
  ["Industry", "industry"],
  ["Description", "description"],
  ["Products and services", "productsAndServices"],
  ["Target customers", "targetCustomers"],
  ["Business hours", "businessHours"],
  ["Location", "location"],
  ["Languages supported", "languages"],
  ["Communication style", "communicationStyle"],
];

const memoryLabels: Array<[string, keyof Brain["memory"]]> = [
  ["Short-term memory", "shortTerm"],
  ["Long-term memory", "longTerm"],
  ["Customer preferences", "customerPreferences"],
  ["Past interactions", "pastInteractions"],
  ["Important business facts", "importantFacts"],
];

const ruleLabels: Array<[string, keyof Brain["rules"]]> = [
  ["Communication tone", "communicationTone"],
  ["Approval rules", "approvalRules"],
  ["Working hours", "workingHours"],
  ["Escalation rules", "escalationRules"],
  ["Restricted actions", "restrictedActions"],
];

export default function BusinessBrainPage() {
  const [brain, setBrain] = useState<Brain | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadBrain() {
      try {
        const response = await fetch("/api/business-brain", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load Business Brain.");
        if (!cancelled) setBrain(data);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load Business Brain.");
      }
    }
    void loadBrain();
    return () => { cancelled = true; };
  }, []);

  if (error) return <State message={error} error />;
  if (!brain) return <State message="Loading Business Brain..." />;

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Business intelligence layer</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Business Brain</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">The shared context, knowledge, and rules that help every AI employee understand your business.</p>
          </div>
          <Link href="/dashboard/knowledge" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-semibold text-white/65 hover:bg-white/[0.08]">Manage knowledge</Link>
        </header>

        <Section eyebrow="Business profile memory" title="What your AI employees know about the business">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {profileFields.map(([label, key]) => <Info key={label} label={label} value={formatValue(brain.profile[key])} wide={key === "description" || key === "productsAndServices" || key === "targetCustomers"} />)}
          </div>
        </Section>

        <Section eyebrow="Knowledge sources" title="Shared business knowledge">
          {brain.sources.length === 0 ? <Empty message="No knowledge sources connected yet." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/30"><th className="px-4 py-3">Source</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last updated</th></tr></thead><tbody>{brain.sources.map((source) => <tr key={source.id} className="border-b border-white/[0.06] text-white/65"><td className="px-4 py-4 font-semibold">{source.name || source.originalName}</td><td className="px-4 py-4 text-white/40">{source.fileType}</td><td className="px-4 py-4"><span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase text-emerald-300">{source.status}</span></td><td className="px-4 py-4 text-white/35">{formatDate(source.updatedAt)}</td></tr>)}</tbody></table></div>}
        </Section>

        <Section eyebrow="AI employee understanding" title="Knowledge access by employee">
          <div className="grid gap-4 md:grid-cols-2">{brain.employees.length ? brain.employees.map((employee) => <Link href={`/dashboard/ai-employees/${employee.id}`} key={employee.id} className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 transition hover:border-cyan-300/20"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">{employee.name}</h3><p className="mt-1 text-xs capitalize text-white/35">{employee.type.replaceAll("-", " ")}</p></div><Status status={employee.status} /></div><p className="mt-5 text-xs uppercase tracking-wider text-white/30">Access</p><div className="mt-3 flex flex-wrap gap-2">{employee.access.length || employee.dedicatedSources.length ? [...new Set([...employee.access, ...employee.dedicatedSources])].map((source) => <span key={source} className="rounded-lg border border-cyan-300/15 bg-cyan-300/[0.06] px-2.5 py-1.5 text-xs text-cyan-200">✓ {source}</span>) : <span className="text-sm text-white/35">Shared business profile only</span>}</div></Link>) : <Empty message="Activate an AI employee to see knowledge access." />}</div>
        </Section>

        <div className="grid gap-6 lg:grid-cols-2"><Section eyebrow="Business memory" title="Context carried across work"><div className="space-y-3">{memoryLabels.map(([label, key]) => <Info key={label} label={label} value={brain.memory[key]} />)}</div></Section><Section eyebrow="Business rules" title="How AI employees should operate"><div className="space-y-3">{ruleLabels.map(([label, key]) => <Info key={label} label={label} value={brain.rules[key]} />)}</div></Section></div>
      </div>
    </main>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">{eyebrow}</p><h2 className="mt-2 text-2xl font-black">{title}</h2><div className="mt-6">{children}</div></section>; }
function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`rounded-2xl border border-white/[0.07] bg-black/20 p-4 ${wide ? "md:col-span-2" : ""}`}><p className="text-xs uppercase tracking-wider text-white/30">{label}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{value}</p></div>; }
function Status({ status }: { status: string }) { const active = status === "active"; return <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${active ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}>{status}</span>; }
function Empty({ message }: { message: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">{message}</div>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
function formatValue(value: string | string[] | null) { return value == null || value.length === 0 ? "Not configured" : Array.isArray(value) ? value.join(", ") : value; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString(); }
