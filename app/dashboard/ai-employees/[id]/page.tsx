"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Employee = {
  id: string;
  name: string;
  type: string;
  status: string;
  supervisionMode: string;
  supervisor: string | null;
};

type Activity = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: string;
};

type Knowledge = {
  sourceCount: number;
  documentsUploaded: number;
  faqsAvailable: boolean;
  businessInformationAvailable: boolean;
  sources: Array<{ id: string; name: string; status: string; fileType: string; employeeId: string | null }>;
};

type Workspace = {
  employee: Employee;
  metrics: {
    conversations: number;
    conversationsToday: number;
    leadsCreated: number;
    tasksCompleted: number;
    followUpsCreated: number;
    handoffs: number;
    successRate: number | null;
  };
  activities: Activity[];
  knowledge: Knowledge;
  salesInsights: {
    conversionRate: number | null;
    objections: Array<{ label: string; count: number }>;
    recommendations: string[];
  } | null;
};

const categories: Record<string, string> = {
  receptionist: "Customer Operations",
  sales: "Revenue Operations",
  "customer-support": "Customer Operations",
  "general-manager": "Executive Operations",
  accountant: "Finance Operations",
  finance: "Finance Operations",
  marketing: "Growth Operations",
  operations: "Business Operations",
  appointment: "Customer Operations",
};

const capabilities: Record<string, string[]> = {
  receptionist: ["Answer customer questions", "Capture customer details", "Book appointments", "Transfer conversations"],
  sales: ["Qualify leads", "Follow up with customers", "Update sales pipeline", "Surface revenue opportunities"],
  "customer-support": ["Answer support questions", "Resolve common issues", "Track customer context", "Escalate complex requests"],
  "general-manager": ["Monitor business operations", "Coordinate AI employees", "Identify bottlenecks", "Recommend next actions"],
};

export default function AIEmployeeWorkspacePage() {
  const params = useParams<{ id: string }>();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      try {
        const response = await fetch(`/api/ai-employees/${params.id}/dashboard`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load AI employee workspace.");
        if (!cancelled) setWorkspace(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load AI employee workspace.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadWorkspace();
    return () => { cancelled = true; };
  }, [params.id]);

  if (loading) return <WorkspaceState message="Loading AI employee workspace..." />;
  if (error || !workspace) return <WorkspaceState message={error || "AI employee not found."} error />;

  const { employee, metrics, activities, knowledge, salesInsights } = workspace;
  const employeeCapabilities = capabilities[employee.type] || ["Complete assigned business tasks", "Work across connected channels", "Maintain customer context", "Escalate when needed"];

  return (
    <main className="min-h-screen bg-[#07070A] px-4 py-7 text-white sm:px-6 lg:px-8 lg:py-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/dashboard/ai-employees" className="text-xs font-semibold text-white/40 transition hover:text-cyan-300">← AI Workforce</Link>

        <section className="mt-5 rounded-3xl border border-white/[0.08] bg-gradient-to-br from-cyan-400/[0.08] via-white/[0.03] to-violet-500/[0.08] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.1] text-2xl text-cyan-300">✦</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">{employee.name}</h1><Status status={employee.status} /></div>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.18em] text-cyan-300/65">{categories[employee.type] || "AI Workforce"}</p>
                <p className="mt-3 text-sm text-white/40">Assigned to your business · {employee.supervisor || "Owner supervised"}</p>
              </div>
            </div>
            <Link href={`/dashboard/employees/${employee.id}/settings`} className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-center text-sm font-semibold text-white/65 hover:bg-white/[0.08]">Configure employee</Link>
            <Link href={`/dashboard/ai-employees/${employee.id}/test`} className="rounded-xl bg-cyan-400 px-4 py-2.5 text-center text-sm font-bold text-black hover:bg-cyan-300">Test employee</Link>
            <Link href={`/dashboard/ai-employees/${employee.id}/deployment`} className="rounded-xl border border-violet-300/20 bg-violet-300/[0.08] px-4 py-2.5 text-center text-sm font-semibold text-violet-200 hover:bg-violet-300/[0.12]">Deployment</Link>
            <Link href={`/dashboard/ai-employees/${employee.id}/permissions`} className="rounded-xl border border-amber-300/20 bg-amber-300/[0.08] px-4 py-2.5 text-center text-sm font-semibold text-amber-200 hover:bg-amber-300/[0.12]">Permissions</Link>
            <Link href={`/dashboard/ai-employees/${employee.id}/voice`} className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 py-2.5 text-center text-sm font-semibold text-cyan-200 hover:bg-cyan-300/[0.12]">Voice</Link>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Metric label="Conversations today" value={metrics.conversationsToday} />
          <Metric label="Leads created" value={metrics.leadsCreated} />
          <Metric label="Tasks completed" value={metrics.tasksCompleted} />
          <Metric label="Follow-ups created" value={metrics.followUpsCreated} />
          <Metric label="Escalations" value={metrics.handoffs} />
          <Metric label="Success rate" value={metrics.successRate == null ? "Not tracked" : `${metrics.successRate}%`} />
        </section>

        {salesInsights && (
          <section className="mt-6 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Sales AI performance</p>
            <h2 className="mt-2 text-2xl font-black">Revenue conversations, decoded</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric label="Handled conversations" value={metrics.conversations} />
              <Metric label="Leads generated" value={metrics.leadsCreated} />
              <Metric label="Conversion rate" value={salesInsights.conversionRate == null ? "Not tracked" : `${salesInsights.conversionRate}%`} />
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div><h3 className="text-sm font-bold text-white/80">Top customer objections</h3><div className="mt-3 space-y-2">{salesInsights.objections.length ? salesInsights.objections.map((item) => <div key={item.label} className="flex justify-between rounded-xl bg-black/20 px-4 py-3 text-sm text-white/60"><span>{item.label}</span><span className="text-cyan-300">{item.count}</span></div>) : <p className="text-sm text-white/35">No objection data recorded yet.</p>}</div></div>
              <div><h3 className="text-sm font-bold text-white/80">Recommended improvements</h3><div className="mt-3 space-y-2">{salesInsights.recommendations.length ? salesInsights.recommendations.map((item) => <p key={item} className="rounded-xl bg-black/20 px-4 py-3 text-sm text-white/60">✓ {item}</p>) : <p className="text-sm text-white/35">Recommendations will appear as Sales activity accumulates.</p>}</div></div>
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-300/70">Activity timeline</p><h2 className="mt-2 text-2xl font-black">Recent actions</h2></div><span className="text-xs text-white/30">{activities.length} recorded</span></div>
            <div className="mt-6 space-y-4">{activities.length ? activities.map((activity) => <div key={activity.id} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-black/20 p-4"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-300 shadow-lg shadow-cyan-300/30" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-bold text-white/85">{activity.title}</p><span className="text-[10px] uppercase tracking-wider text-emerald-300/60">{activity.status}</span></div>{activity.description && <p className="mt-1 text-sm leading-6 text-white/40">{activity.description}</p>}<p className="mt-2 text-[10px] text-white/25">{formatDate(activity.createdAt)}</p></div></div>) : <Empty message="Actions will appear as this AI employee completes work." />}</div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-violet-300/70">Tools and capabilities</p><h2 className="mt-2 text-2xl font-black">What {employee.name} can do</h2><div className="mt-6 space-y-3">{employeeCapabilities.map((capability) => <div key={capability} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3 text-sm text-white/65"><span className="text-emerald-300">✓</span>{capability}</div>)}</div></section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300/70">Knowledge center</p><h2 className="mt-2 text-2xl font-black">Connected business knowledge</h2><div className="mt-6 grid gap-3 sm:grid-cols-2"><KnowledgeMetric label="Knowledge sources" value={knowledge.sourceCount} /><KnowledgeMetric label="Documents uploaded" value={knowledge.documentsUploaded} /><KnowledgeMetric label="FAQs available" value={knowledge.faqsAvailable ? "Ready" : "Not configured"} /><KnowledgeMetric label="Business information" value={knowledge.businessInformationAvailable ? "Ready" : "Not configured"} /></div><div className="mt-5 space-y-2">{knowledge.sources.slice(0, 4).map((source) => <div key={source.id} className="flex items-center justify-between rounded-xl bg-black/20 px-3 py-2.5 text-xs"><span className="truncate text-white/60">{source.name}</span><span className="ml-3 shrink-0 text-white/25">{source.status}</span></div>)}</div><Link href="/dashboard/knowledge" className="mt-5 inline-flex text-sm font-semibold text-cyan-300/75 hover:text-cyan-300">Manage knowledge →</Link></section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-300/70">Approval control</p><h2 className="mt-2 text-2xl font-black">Actions requiring approval</h2><p className="mt-3 text-sm leading-6 text-white/40">Configure which actions need human review before this employee executes them.</p><div className="mt-6 space-y-3">{["External messages", "Discounts and refunds", "Customer data changes", "Pipeline changes"].map((item) => <div key={item} className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5"><span className="text-sm text-white/65">{item}</span><span className="rounded-full border border-amber-300/15 bg-amber-300/[0.06] px-2.5 py-1 text-[10px] font-bold uppercase text-amber-300/70">Review</span></div>)}</div></section>
        </div>
      </div>
    </main>
  );
}

function Status({ status }: { status: string }) { const active = status === "active"; return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${active ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-400" : "bg-amber-400"}`} />{status}</span>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs leading-5 text-white/35">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>; }
function KnowledgeMetric({ label, value }: { label: string; value: number | string }) { return <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3"><p className="text-xs text-white/35">{label}</p><p className="mt-2 text-lg font-black text-white/80">{value}</p></div>; }
function Empty({ message }: { message: string }) { return <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-white/35">{message}</div>; }
function WorkspaceState({ message, error = false }: { message: string; error?: boolean }) { return <main className="flex min-h-screen items-center justify-center bg-[#07070A] px-6 text-white"><div className={`rounded-2xl border p-6 text-center text-sm ${error ? "border-red-400/20 text-red-200" : "border-white/10 text-white/45"}`}>{message}</div></main>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(); }
