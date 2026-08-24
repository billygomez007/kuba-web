"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Data = { summary: Record<string, number | string>; commercial: { revenue: string }; partners: Record<string, number>; events: Array<{ id: string; action: string; description: string | null; createdAt: string }>; activities: Array<{ id: string; title: string; type: string; status: string; createdAt: string }> };
const platformMetrics = [["Total businesses", "totalBusinesses"], ["Active businesses", "activeBusinesses"], ["Registered users", "registeredUsers"], ["Business users", "businessUsers"], ["AI employees", "totalEmployees"], ["Active employees", "activeEmployees"], ["Deployed employees", "deployedEmployees"], ["Voice-enabled employees", "voiceEnabledEmployees"], ["Integrations", "integrations"], ["Automations", "automations"], ["Conversations", "conversations"], ["Messages", "messages"]] as const;
const commercialMetrics = [["Subscriptions", "totalSubscriptions"], ["Active", "activeSubscriptions"], ["Trialing", "trialingSubscriptions"], ["Past due", "pastDueSubscriptions"], ["Canceled", "canceledSubscriptions"], ["Starter", "starter"], ["Growth", "growth"], ["Pro", "pro"], ["Enterprise", "enterprise"], ["Legacy", "legacy"], ["Paystack", "paystack"], ["Stripe", "stripe"], ["Manual", "manual"]] as const;

export default function AdminPage() {
  const [data, setData] = useState<Data | null>(null); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void fetch("/api/admin/overview", { cache: "no-store" })
        .then(async (response) => {
          const result = await response.json();
          if (!active) return;
          if (response.ok) setData(result);
          else setError(result.error || "Unable to load admin console.");
        })
        .catch(() => {
          if (!active) return;
          setError("Unable to load admin console.");
        });
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, []);
  if (!data) return <State message={error || "Loading Super Admin control center..."} error={Boolean(error)} />;
  return <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12"><div className="mx-auto max-w-[1550px]"><header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">SuperKuba internal operations</p><h1 className="mt-3 text-4xl font-black tracking-[-0.05em] sm:text-5xl">Platform headquarters</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-white/40">Commercial, workforce, usage, and operational visibility across every customer business.</p></div><Link href="/admin/businesses" className="rounded-xl bg-cyan-400 px-5 py-3 text-center text-sm font-bold text-black">Open business directory</Link></header><Section title="Platform overview" items={platformMetrics} summary={data.summary} /><Section title="Commercial overview" items={commercialMetrics} summary={data.summary} /><div className="mt-6 grid gap-6 lg:grid-cols-3"><Panel title="Platform health"><Health label="Failed automations" value={data.summary.failedAutomations} tone="danger" /><Health label="AI employee failures" value={data.summary.aiFailures} tone="danger" /><Health label="Integration failures" value={data.summary.integrationFailures} tone="warning" /><Health label="Human escalations" value={data.summary.escalations} tone="warning" /><Health label="Pending approvals" value={data.summary.pendingApprovals} tone="warning" /><Health label="Paused employees" value={data.summary.pausedEmployees} tone="neutral" /></Panel><Panel title="Usage overview"><Health label="Conversations" value={data.summary.conversations} tone="neutral" /><Health label="Messages" value={data.summary.messages} tone="neutral" /><Health label="Automation runs" value={data.summary.automationRuns || "Not tracked"} tone="neutral" /><Health label="Voice calls" value={data.summary.voiceCalls} tone="neutral" /><Health label="Voice minutes" value={data.summary.voiceMinutes} tone="neutral" /><Health label="Billing attention" value={data.summary.billingAttention} tone="warning" /></Panel><Panel title="Partner marketplace"><Health label="Partners" value={data.partners.total} tone="neutral" /><Health label="Verified" value={data.partners.verified} tone="success" /><Health label="Pending verification" value={data.partners.pending} tone="warning" /><Health label="Draft products" value={data.partners.products} tone="neutral" /><Health label="Submitted" value={data.partners.submittedProducts} tone="warning" /><Link href="/admin/marketplace/reviews" className="mt-4 inline-flex text-sm font-semibold text-cyan-300">Review marketplace →</Link></Panel></div><div className="mt-6 grid gap-6 lg:grid-cols-2"><Panel title="Recent platform activity">{data.activities.length ? data.activities.slice(0, 12).map((item) => <Activity key={item.id} title={item.title} meta={`${item.type} · ${item.status}`} date={item.createdAt} />) : <Empty message="No platform activity recorded." />}</Panel><Panel title="Billing events">{data.events.length ? data.events.slice(0, 12).map((item) => <Activity key={item.id} title={item.action} meta={item.description || "Commercial event recorded."} date={item.createdAt} />) : <Empty message="No billing events recorded." />}</Panel></div><p className="mt-6 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm text-white/40">{data.commercial.revenue}</p></div></main>;
}
function Section({ title, items, summary }: { title: string; items: ReadonlyArray<readonly [string, string]>; summary: Record<string, number | string> }) { return <section className="mt-8"><h2 className="text-2xl font-black">{title}</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">{items.map(([label, key]) => <Metric key={key} label={label} value={summary[key] ?? "Not tracked"} />)}</div></section>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs leading-5 text-white/35">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6"><h2 className="text-xl font-black">{title}</h2><div className="mt-5 space-y-2">{children}</div></section>; }
function Health({ label, value, tone }: { label: string; value: number | string; tone: "danger" | "warning" | "success" | "neutral" }) { const color = tone === "danger" ? "text-red-200" : tone === "warning" ? "text-amber-200" : tone === "success" ? "text-emerald-200" : "text-cyan-200"; return <div className="flex items-center justify-between rounded-xl bg-black/20 p-3 text-sm"><span className="text-white/55">{label}</span><span className={`font-bold ${color}`}>{value}</span></div>; }
function Activity({ title, meta, date }: { title: string; meta: string; date: string }) { return <div className="flex items-start justify-between gap-3 rounded-xl bg-black/20 p-3"><div><p className="text-sm font-semibold text-white/75">{title}</p><p className="mt-1 text-xs text-white/35">{meta}</p></div><time className="shrink-0 text-[10px] text-white/25">{new Date(date).toLocaleDateString()}</time></div>; }
function Empty({ message }: { message: string }) { return <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">{message}</p>; }
function State({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#050507] px-6 text-sm"><p className={error ? "text-red-200" : "text-white/40"}>{message}</p></main>; }