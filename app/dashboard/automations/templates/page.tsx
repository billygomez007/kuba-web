"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Template = {
  id: string;
  name: string;
  description: string;
  industry: string;
  trigger: string;
  actions: Array<{ type: string }>;
  requiredEmployees: string[];
  requiredIntegrations: string[];
  setupInstructions: string[];
  installed: boolean;
  missingRequirements: string[];
};

const industries = ["All", "General Business", "Dental Clinic", "Pharmacy", "Travel Agency", "Real Estate", "Law Firm"];

export default function AutomationTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [search, setSearch] = useState("");
  const [industry, setIndustry] = useState("All");
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function loadTemplates() {
    try {
      const response = await fetch("/api/automations/templates", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load templates.");
      setTemplates(data.templates || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load templates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTemplates();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesIndustry = industry === "All" || template.industry === industry;
      const matchesSearch = !query || [template.name, template.description, template.industry, template.trigger].some((value) => value.toLowerCase().includes(query));
      return matchesIndustry && matchesSearch;
    });
  }, [templates, search, industry]);

  async function install(template: Template) {
    setInstalling(template.id);
    setMessage("");
    try {
      const response = await fetch("/api/automations/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId: template.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.missingRequirements?.join(" · ") || data.error || "Unable to install template.");
      setMessage(`${template.name} installed and activated.`);
      await loadTemplates();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to install template.");
    } finally {
      setInstalling(null);
    }
  }

  return <main className="min-h-screen bg-[#050507] px-5 py-8 text-white sm:px-8 lg:px-10 lg:py-12"><div className="mx-auto max-w-7xl"><Link href="/dashboard/automations" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Automation Engine</Link><header className="mt-5 flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Automation Marketplace</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Start with a proven workflow</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Install prepared automations for the work your business does every day. Requirements are checked before anything is activated.</p></div><Link href="/dashboard/automations" className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-semibold text-white/65 hover:bg-white/[0.08]">View installed workflows</Link></header>{message && <p className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-3 text-sm text-cyan-100">{message}</p>}<div className="mt-8 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search templates..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /><select value={industry} onChange={(event) => setIndustry(event.target.value)} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70 outline-none sm:w-56">{industries.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{loading ? <p className="mt-10 text-sm text-white/35">Loading automation templates...</p> : <div className="mt-8 grid gap-5 lg:grid-cols-2">{filtered.map((template) => <article key={template.id} className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 transition hover:border-cyan-300/20"><div className="flex items-start justify-between gap-4"><div><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300/70">{template.industry}</span><h2 className="mt-2 text-xl font-black">{template.name}</h2></div><span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase ${template.installed ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-white/10 bg-white/[0.04] text-white/35"}`}>{template.installed ? "Installed" : "Template"}</span></div><p className="mt-3 text-sm leading-6 text-white/45">{template.description}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] uppercase tracking-wider text-white/30">Trigger</p><p className="mt-1 text-xs font-semibold text-white/65">{template.trigger.replaceAll(".", " ")}</p></div><div className="rounded-xl bg-black/20 p-3"><p className="text-[10px] uppercase tracking-wider text-white/30">Actions</p><p className="mt-1 text-xs font-semibold text-white/65">{template.actions.length} workflow actions</p></div></div>{template.missingRequirements.length > 0 && <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-300">Setup required</p><p className="mt-2 text-xs leading-5 text-amber-100/70">{template.missingRequirements.join(" · ")}</p></div>}<div className="mt-5 flex items-center justify-between gap-3"><p className="text-xs text-white/30">{template.setupInstructions[0]}</p><button type="button" onClick={() => void install(template)} disabled={template.installed || template.missingRequirements.length > 0 || installing === template.id} className="shrink-0 rounded-xl bg-cyan-400 px-4 py-2.5 text-xs font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">{installing === template.id ? "Installing..." : template.installed ? "Installed" : "Install"}</button></div></article>)}{filtered.length === 0 && <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-white/35 lg:col-span-2">No templates match this view.</div>}</div>}</div></main>;
}
