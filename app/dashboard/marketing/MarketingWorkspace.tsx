"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  scheduledAt: string | null;
  metrics?: { enrolled?: number; handedOff?: number; failed?: number };
};

const sections = [
  ["Campaigns", "/dashboard/marketing/campaigns", "Plan and monitor tenant-scoped campaigns."],
  ["Content Studio", "/dashboard/marketing/content", "Prepare channel-specific drafts for review."],
  ["Content Calendar", "/dashboard/marketing/calendar", "See planned internal marketing activity."],
  ["Audiences", "/dashboard/marketing/audiences", "Define lawful segments from existing business data."],
  ["Assets", "/dashboard/marketing/assets", "Keep a catalog ready for future provider connections."],
  ["Approvals", "/dashboard/marketing/approvals", "Review work before anything can publish."],
  ["Social accounts", "/dashboard/marketing/social", "Provider connections are intentionally not active yet."],
  ["Analytics", "/dashboard/marketing/analytics", "Native counts only; no invented provider metrics."],
] as const;

export default function MarketingWorkspace({ mode = "overview" }: { mode?: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/marketing/campaigns", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load campaigns.");
        if (!cancelled) setCampaigns(body.campaigns ?? []);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Unable to load campaigns.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => ({
    active: campaigns.filter((campaign) => ["running", "active"].includes(campaign.status)).length,
    scheduled: campaigns.filter((campaign) => Boolean(campaign.scheduledAt) || campaign.status === "scheduled").length,
    recipients: campaigns.reduce((sum, campaign) => sum + (campaign.metrics?.enrolled ?? 0), 0),
  }), [campaigns]);

  const title = mode === "overview" ? "Kuba Marketing" : sections.find((section) => section[1].endsWith(`/${mode}`))?.[0] ?? "Kuba Marketing";
  const description = mode === "overview"
    ? "Plan, create, approve, schedule, and measure your marketing from one workspace."
    : sections.find((section) => section[1].endsWith(`/${mode}`))?.[2] ?? "Marketing workspace";

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1450px]">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Marketing command center</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-text-tertiary">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/marketing/content" className="rounded-control border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-white hover:border-border-strong">Create content</Link>
            <Link href="/dashboard/marketing/campaigns/new" className="rounded-control bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300">Create campaign</Link>
          </div>
        </header>

        {mode === "overview" || mode === "campaigns" ? (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Active campaigns" value={loading ? "—" : stats.active} />
              <Stat label="Scheduled content" value={loading ? "—" : stats.scheduled} />
              <Stat label="Recipients enrolled" value={loading ? "—" : stats.recipients} />
              <Stat label="External metrics" value="Not connected" muted />
            </section>
            <section className="mt-8 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
              <div className="rounded-card border border-border-default bg-surface-card p-6">
                <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-bold">Campaign performance</h2><Link href="/dashboard/marketing/analytics" className="text-xs font-semibold text-cyan-300">View analytics</Link></div>
                {error ? <p className="mt-6 text-sm text-danger">{error}</p> : campaigns.length === 0 ? <Empty title="No campaigns yet" body="Create a campaign to start building a truthful native marketing plan." href="/dashboard/marketing" label="Create campaign" /> : <div className="mt-6 space-y-3">{campaigns.slice(0, 5).map((campaign) => <Link key={campaign.id} href={`/dashboard/marketing/campaigns/${campaign.id}`} className="flex items-center justify-between rounded-control border border-border-muted bg-surface-page/40 px-4 py-3 hover:border-border-strong"><span><span className="block text-sm font-semibold">{campaign.name}</span><span className="text-xs text-text-tertiary">{campaign.status}</span></span><span className="text-xs text-text-muted">Native campaign</span></Link>)}</div>}
              </div>
              <div className="rounded-card border border-border-default bg-surface-card p-6"><h2 className="text-lg font-bold">Kuba Marketing AI</h2><p className="mt-3 text-sm leading-6 text-text-tertiary">Kuba Marketing can ground campaign and content drafts in Business Brain data. Every draft remains subject to human review and approval.</p><Link href="/dashboard/ai-employees" className="mt-5 inline-flex text-sm font-semibold text-cyan-300">Open AI Workforce →</Link></div>
            </section>
          </>
        ) : (
          <section className="mt-8 rounded-card border border-border-default bg-surface-card p-6"><Empty title={`${title} is ready for native planning`} body={description + " External provider execution is not connected, so this workspace will never claim a post was published without a provider result."} href="/dashboard/marketing" label="Back to overview" /></section>
        )}

        <section className="mt-8"><h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Marketing workspace</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{sections.map(([label, href, body]) => <Link key={href} href={href} className="rounded-card border border-border-default bg-surface-card p-5 transition hover:border-border-strong"><h3 className="font-semibold">{label}</h3><p className="mt-2 text-sm leading-5 text-text-tertiary">{body}</p></Link>)}</div></section>
      </div>
    </main>
  );
}

function Stat({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) { return <div className="rounded-card border border-border-default bg-surface-card p-5"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">{label}</p><p className={`mt-2 text-2xl font-black ${muted ? "text-text-tertiary text-base" : ""}`}>{value}</p></div>; }
function Empty({ title, body, href, label = "Create campaign" }: { title: string; body: string; href: string; label?: string }) { return <div className="mt-6 rounded-control border border-dashed border-border-muted bg-surface-page/30 p-6"><h3 className="font-semibold">{title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-text-tertiary">{body}</p><Link href={href} className="mt-4 inline-flex text-sm font-semibold text-cyan-300">{label} →</Link></div>; }
