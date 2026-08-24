"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Package = {
  id: string;
  name: string;
  industry: string;
  description: string;
  employees: Array<{ type: string; name: string; description: string }>;
  automationTemplateIds: string[];
  knowledgeTemplates: string[];
  requiredIntegrations: string[];
  setupSteps: string[];
  installed: boolean;
  missingRequirements: string[];
};

const industries = ["All", "Dental Clinic", "Pharmacy", "Travel Agency", "Real Estate", "Law Firm"];

export default function WorkforceMarketplacePage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [industry, setIndustry] = useState("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadPackages() {
    try {
      const response = await fetch("/api/workforce-packages", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load workforce packages.");
      setPackages(data.packages || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load workforce packages.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPackages();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => packages.filter((item) => {
    const query = search.trim().toLowerCase();
    return (industry === "All" || item.industry === industry) && (!query || `${item.name} ${item.description}`.toLowerCase().includes(query));
  }), [packages, industry, search]);

  async function install(item: Package) {
    setInstalling(item.id);
    setMessage("");
    try {
      const response = await fetch("/api/workforce-packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: item.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.missingRequirements?.join(" · ") || data.error || "Unable to install package.");
      setMessage(`${item.name} installed. ${data.employeesCreated.length} employees created and ${data.automationsInstalled.length} automations activated.`);
      await loadPackages();
      setSelected(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to install package.");
    } finally {
      setInstalling(null);
    }
  }

  return <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12"><div className="mx-auto max-w-7xl"><Link href="/dashboard/workforce" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← AI Workforce</Link><header className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Workforce Marketplace</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Deploy a complete AI team</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Industry-ready employee groups, workflows, and knowledge checklists for a faster start.</p></header>{message && <p className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-3 text-sm text-cyan-100">{message}</p>}<div className="mt-8 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workforce packages..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /><select value={industry} onChange={(event) => setIndustry(event.target.value)} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70 sm:w-56">{industries.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{loading ? <p className="mt-10 text-sm text-white/35">Loading workforce packages...</p> : <div className="mt-8 grid gap-5 lg:grid-cols-2">{filtered.map((item) => <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-cyan-300/20"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300/70">{item.industry}</span><h2 className="mt-2 text-2xl font-black">{item.name}</h2></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${item.installed ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-white/35"}`}>{item.installed ? "Installed" : "Package"}</span></div><p className="mt-3 text-sm leading-6 text-white/45">{item.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="AI employees" value={item.employees.length} /><Stat label="Automations" value={item.automationTemplateIds.length} /><Stat label="Knowledge areas" value={item.knowledgeTemplates.length} /></div><div className="mt-5 flex flex-wrap gap-2">{item.employees.map((employee) => <span key={employee.name} className="rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-1.5 text-xs text-white/55">✦ {employee.name}</span>)}</div>{item.missingRequirements.length > 0 && <div className="mt-5 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 text-xs leading-5 text-amber-100/70"><strong className="font-bold text-amber-300">Setup required:</strong> {item.missingRequirements.join(" · ")}</div>}<div className="mt-6 flex gap-3"><button type="button" onClick={() => setSelected(item)} className="flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/[0.05]">View package</button><button type="button" onClick={() => void install(item)} disabled={item.installed || item.missingRequirements.length > 0 || installing === item.id} className="flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-black disabled:opacity-40">{installing === item.id ? "Installing..." : item.installed ? "Installed" : "Install package"}</button></div></article>)}{filtered.length === 0 && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35 lg:col-span-2">No workforce packages match this view.</div>}</div>}{selected && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#111116] p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-cyan-300/70">{selected.industry}</p><h2 className="mt-2 text-2xl font-black">{selected.name}</h2></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-white/50">Close</button></div><p className="mt-4 text-sm leading-6 text-white/50">{selected.description}</p><h3 className="mt-7 text-sm font-bold text-white/80">Setup steps</h3><ol className="mt-3 space-y-2 text-sm text-white/50">{selected.setupSteps.map((step, index) => <li key={step}><span className="mr-2 text-cyan-300">{index + 1}.</span>{step}</li>)}</ol><h3 className="mt-7 text-sm font-bold text-white/80">Knowledge templates</h3><div className="mt-3 flex flex-wrap gap-2">{selected.knowledgeTemplates.map((item) => <span key={item} className="rounded-lg bg-cyan-300/[0.08] px-3 py-2 text-xs text-cyan-100">{item}</span>)}</div><button type="button" onClick={() => void install(selected)} disabled={selected.installed || selected.missingRequirements.length > 0 || installing === selected.id} className="mt-8 w-full rounded-xl bg-cyan-400 px-4 py-3 text-sm font-bold text-black disabled:opacity-40">{selected.installed ? "Package installed" : installing === selected.id ? "Installing..." : "Install package"}</button></div></div>}</div></main>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-black/20 p-3"><p className="text-xs text-white/30">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>; }
