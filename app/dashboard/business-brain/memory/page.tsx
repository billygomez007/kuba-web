"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type MemoryItem = { id: string; category: string; title: string; content: string; source: string; updatedAt: string; usedBy: string[]; deletable: boolean };
type CountItem = { label: string; count: number };
type MemoryData = { memory: MemoryItem[]; learning: { commonQuestions: CountItem[]; failedResponses: string[]; escalationReasons: CountItem[]; customerObjections: CountItem[]; knowledgeGaps: CountItem[]; suggestions: string[] }; stats: Record<string, number> };

const categories = ["All", "Business memory", "Customer memory", "Employee memory", "Knowledge source"];

export default function BusinessMemoryPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");

  async function loadMemory() {
    try {
      const response = await fetch("/api/business-brain/memory", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load memory.");
      setData(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load memory.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadMemory(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const visible = useMemo(() => (data?.memory || []).filter((item) => {
    const query = search.trim().toLowerCase();
    return (category === "All" || item.category === category) && (!query || `${item.title} ${item.content} ${item.source}`.toLowerCase().includes(query));
  }), [data, category, search]);

  async function deleteItem(item: MemoryItem) {
    if (!item.deletable || !window.confirm("Delete this knowledge source?")) return;
    const response = await fetch("/api/ai/knowledge/sources", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: item.id }) });
    const result = await response.json();
    setMessage(response.ok ? "Memory source deleted." : result.error || "Unable to delete memory source.");
    if (response.ok) await loadMemory();
  }

  if (!data) return <State message={message || "Loading business memory..."} error={Boolean(message)} />;

  return <main className="min-h-screen bg-[#07070A] px-4 py-8 text-white sm:px-6 lg:px-8 lg:py-12"><div className="mx-auto max-w-7xl"><Link href="/dashboard/business-brain" className="text-xs font-semibold text-white/40 hover:text-cyan-300">← Business Brain</Link><header className="mt-5"><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Memory management</p><h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Business memory</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-white/40">Review the business facts, customer context, knowledge sources, and employee activity available to your AI workforce.</p></header>{message && <p className="mt-6 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.05] p-3 text-sm text-cyan-100">{message}</p>}<section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[["Business", data.stats.businessMemory], ["Sources", data.stats.knowledgeSources], ["Customer", data.stats.customerMemory], ["Employee", data.stats.employeeMemory], ["Conversations", data.stats.conversations]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-white/35">{label} memory</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</section><section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><div className="flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stored memory..." className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/25 focus:border-cyan-300/40" /><select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-white/10 bg-[#111116] px-4 py-3 text-sm text-white/70 sm:w-56">{categories.map((item) => <option key={item}>{item}</option>)}</select></div><div className="mt-6 space-y-3">{visible.length ? visible.map((item) => <article key={item.id} className="rounded-2xl border border-white/[0.07] bg-black/20 p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><span className="text-[10px] font-bold uppercase tracking-wider text-violet-300/70">{item.category}</span><h2 className="mt-2 text-lg font-bold text-white/85">{item.title}</h2></div>{item.deletable && <button type="button" onClick={() => void deleteItem(item)} className="rounded-lg border border-red-400/15 px-3 py-1.5 text-[10px] font-bold uppercase text-red-300">Delete source</button>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/55">{item.content}</p><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/25"><span>Source: {item.source}</span><span>Updated: {formatDate(item.updatedAt)}</span><span>Used by: {item.usedBy.length ? item.usedBy.join(", ") : "Business context"}</span></div></article>) : <Empty message="No memory matches this view." />}</div></section><LearningDashboard learning={data.learning} /></div></main>;
}

function LearningDashboard({ learning }: { learning: MemoryData["learning"] }) { return <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Continuous learning</p><h2 className="mt-2 text-2xl font-black">AI employee learning insights</h2><p className="mt-2 text-sm text-white/40">Signals derived from stored customer and operational records. Private reasoning is never displayed.</p><div className="mt-6 grid gap-6 lg:grid-cols-3"><Insight title="Common questions" items={learning.commonQuestions.map((item) => `${item.label} (${item.count})`)} empty="No questions recorded." /><Insight title="Escalation reasons" items={learning.escalationReasons.map((item) => `${item.label} (${item.count})`)} empty="No escalations recorded." /><Insight title="Knowledge gaps" items={learning.knowledgeGaps.map((item) => item.label)} empty="No knowledge gaps detected." /></div><div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.04] p-5"><p className="text-xs font-bold uppercase tracking-wider text-violet-200/70">Improvement suggestions</p>{learning.suggestions.length ? <ul className="mt-3 space-y-2 text-sm leading-6 text-white/55">{learning.suggestions.map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-3 text-sm text-white/35">Suggestions will appear as more operational data is recorded.</p>}</div></section>; }
function Insight({ title, items, empty }: { title: string; items: string[]; empty: string }) { return <div><h3 className="text-sm font-bold text-white/75">{title}</h3><div className="mt-3 space-y-2">{items.length ? items.slice(0, 5).map((item) => <div key={item} className="rounded-xl bg-black/20 px-3 py-2.5 text-xs text-white/55">{item}</div>) : <p className="text-xs text-white/30">{empty}</p>}</div></div>; }
function Empty({ message }: { message: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/35">{message}</div>; }
function State({ message, error }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-center text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString(); }
