/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Card from "@/app/components/ui/Card";
import MetricCard from "@/app/components/ui/MetricCard";
import StatusBadge, { type SemanticStatus } from "@/app/components/ui/StatusBadge";
import LoadingState from "@/app/components/ui/LoadingState";
import ErrorState, { type ErrorVariant } from "@/app/components/ui/ErrorState";
import EmptyState from "@/app/components/EmptyState";

type IsoDate = string;

type OverviewUpcomingActivity = {
  id: string;
  type: "campaign_start" | "campaign_end" | "content_scheduled" | "publish_job";
  at: IsoDate;
  title: string;
  channel: string | null;
  status: string;
  campaignId: string | null;
};

type OverviewData = {
  summary: {
    activeCampaigns: number;
    contentPieces: number;
    scheduledContent: number;
    pendingApprovals: number;
    leadsAttributed: number;
  };
  campaignActivity: { status: string; count: number }[];
  upcoming: OverviewUpcomingActivity[];
  recentCampaigns: { id: string; name: string; objective: string; status: string; startAt: IsoDate | null; endAt: IsoDate | null }[];
  recentContent: { id: string; title: string; contentType: string; status: string; approvalStatus: string; updatedAt: IsoDate }[];
  channelReadiness: { provider: string; label: string; state: "connected" | "not_connected" | "needs_attention" | "expired" | "disabled"; displayName: string | null; handle: string | null }[];
  audienceOverview: { total: number; latest: { id: string; name: string; status: string; estimatedCount: number | null; updatedAt: IsoDate }[] };
  approvalQueue: { id: string; resourceType: string; resourceId: string; resourceName: string | null; requesterName: string | null; createdAt: IsoDate; status: string }[];
  recentActivity: { id: string; action: string; description: string | null; createdAt: IsoDate }[];
};

const UPCOMING_TYPE_LABEL: Record<OverviewUpcomingActivity["type"], string> = {
  campaign_start: "Campaign start",
  campaign_end: "Campaign end",
  content_scheduled: "Content scheduled",
  publish_job: "Publish job",
};

const CHANNEL_STATE_META: Record<OverviewData["channelReadiness"][number]["state"], { label: string; status: SemanticStatus }> = {
  connected: { label: "Connected", status: "success" },
  not_connected: { label: "Not Connected", status: "neutral" },
  needs_attention: { label: "Needs Attention", status: "warning" },
  expired: { label: "Expired", status: "danger" },
  disabled: { label: "Disabled", status: "danger" },
};

const RESOURCE_TYPE_LABEL: Record<string, string> = {
  marketing_campaign: "Campaign",
  marketing_content_item: "Content",
};

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });
}

const WORKSPACE_SECTIONS = [
  ["Campaigns", "/dashboard/marketing/campaigns", "Plan and monitor tenant-scoped campaigns."],
  ["Content Studio", "/dashboard/marketing/content", "Prepare channel-specific drafts for review."],
  ["Content Calendar", "/dashboard/marketing/calendar", "See planned internal marketing activity."],
  ["Audiences", "/dashboard/marketing/audiences", "Define lawful segments from existing business data."],
  ["Assets", "/dashboard/marketing/assets", "Keep a catalog ready for future provider connections."],
  ["Approvals", "/dashboard/marketing/approvals", "Review work before anything can publish."],
  ["Publishing", "/dashboard/marketing/publishing", "Inspect scheduling intent and persisted provider results."],
  ["Channel Readiness", "/dashboard/marketing/social", "Provider connections are intentionally not active yet."],
  ["Analytics", "/dashboard/marketing/analytics", "Native counts only; no invented provider metrics."],
] as const;

export default function MarketingOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] = useState<ErrorVariant>("inline");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch("/api/marketing/overview", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setErrorVariant(response.status === 401 || response.status === 403 ? "permission" : "inline");
          throw new Error(body.error || "Unable to load the Marketing overview.");
        }
        setData(body.overview);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load the Marketing overview."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1450px]">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Marketing command center</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Kuba Marketing</h1>
            <p className="mt-3 max-w-2xl text-sm text-text-tertiary">Plan, create, approve, schedule, publish, and measure marketing from one workspace.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/dashboard/marketing/content/new" className="rounded-control border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-white hover:border-border-strong">Create Content</Link>
            <Link href="/dashboard/marketing/campaigns/new" className="rounded-control bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300">Create Campaign</Link>
          </div>
        </header>

        {loading ? (
          <div className="mt-8"><LoadingState variant="panel" message="Loading Kuba Marketing overview…" /></div>
        ) : error ? (
          <div className="mt-8"><ErrorState variant={errorVariant} message={error} onRetry={load} /></div>
        ) : data ? (
          <OverviewBody data={data} />
        ) : null}

        <section className="mt-8">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">Marketing workspace</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKSPACE_SECTIONS.map(([label, href, body]) => (
              <Link key={href} href={href} className="rounded-card border border-border-default bg-surface-card p-5 transition hover:border-border-strong">
                <h3 className="font-semibold">{label}</h3>
                <p className="mt-2 text-sm leading-5 text-text-tertiary">{body}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function OverviewBody({ data }: { data: OverviewData }) {
  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard label="Active Campaigns" value={data.summary.activeCampaigns} href="/dashboard/marketing/campaigns" />
        <MetricCard label="Content Pieces" value={data.summary.contentPieces} href="/dashboard/marketing/content" />
        <MetricCard label="Scheduled Content" value={data.summary.scheduledContent} href="/dashboard/marketing/calendar" />
        <MetricCard label="Pending Approvals" value={data.summary.pendingApprovals} href="/dashboard/marketing/approvals" />
        <MetricCard label="Leads Attributed" value={data.summary.leadsAttributed} />
      </section>

      <section className="mt-8">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Campaign activity</h2>
            <Link href="/dashboard/marketing/campaigns" className="text-xs font-semibold text-cyan-300">View campaigns</Link>
          </div>
          {data.campaignActivity.length === 0 ? (
            <p className="mt-6 text-sm text-text-tertiary">No campaigns have been created yet.</p>
          ) : (
            <div className="mt-6 flex flex-wrap gap-3">
              {data.campaignActivity.map((bucket) => (
                <div key={bucket.status} className="min-w-[120px] rounded-control border border-border-muted bg-surface-page/40 px-4 py-3">
                  <p className="text-2xl font-black">{bucket.count}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-text-tertiary">{titleCase(bucket.status)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <h2 className="text-lg font-bold">Upcoming activities</h2>
          {data.upcoming.length === 0 ? (
            <EmptyState icon="◔" title="Nothing scheduled" description="Campaign dates and scheduled content will appear here once planned." compact className="mt-6" />
          ) : (
            <div className="mt-6 divide-y divide-border-muted">
              {data.upcoming.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-xs font-semibold text-text-tertiary sm:w-40">{formatDateTime(item.at)}</span>
                    <span className="text-xs font-bold uppercase tracking-wide text-cyan-300/80 sm:w-36">{UPCOMING_TYPE_LABEL[item.type]}</span>
                    <span className="text-sm font-semibold">{item.title}{item.channel ? <span className="ml-2 text-xs font-normal text-text-tertiary">{titleCase(item.channel)}</span> : null}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={item.status} label={titleCase(item.status)} />
                    {item.campaignId && <Link href={`/dashboard/marketing/campaigns/${item.campaignId}`} className="text-xs font-semibold text-cyan-300">View campaign</Link>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Recent campaigns</h2>
            <Link href="/dashboard/marketing/campaigns" className="text-xs font-semibold text-cyan-300">View all</Link>
          </div>
          {data.recentCampaigns.length === 0 ? (
            <EmptyState icon="◇" title="No campaigns yet" description="Create a campaign to start building a truthful native marketing plan." actionLabel="Create Campaign" actionHref="/dashboard/marketing/campaigns/new" compact className="mt-6" />
          ) : (
            <div className="mt-6 divide-y divide-border-muted">
              {data.recentCampaigns.map((campaign) => (
                <Link key={campaign.id} href={`/dashboard/marketing/campaigns/${campaign.id}`} className="flex items-center justify-between gap-4 py-4 hover:opacity-80">
                  <div>
                    <p className="text-sm font-semibold">{campaign.name}</p>
                    <p className="mt-1 text-xs text-text-tertiary">{titleCase(campaign.objective)} · {campaign.startAt ? formatDate(campaign.startAt) : "No start date"}{campaign.endAt ? ` – ${formatDate(campaign.endAt)}` : ""}</p>
                  </div>
                  <StatusBadge status={campaign.status} label={titleCase(campaign.status)} />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Recent content</h2>
            <Link href="/dashboard/marketing/content" className="text-xs font-semibold text-cyan-300">View all</Link>
          </div>
          {data.recentContent.length === 0 ? (
            <EmptyState icon="◇" title="No content yet" description="Create content to prepare channel-specific drafts for review." actionLabel="Create Content" actionHref="/dashboard/marketing/content/new" compact className="mt-6" />
          ) : (
            <div className="mt-6 divide-y divide-border-muted">
              {data.recentContent.map((item) => (
                <Link key={item.id} href={`/dashboard/marketing/content/${item.id}`} className="flex items-center justify-between gap-4 py-4 hover:opacity-80">
                  <div>
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-xs text-text-tertiary">{titleCase(item.contentType)} · Approval: {titleCase(item.approvalStatus)} · {formatDate(item.updatedAt)}</p>
                  </div>
                  <StatusBadge status={item.status} label={titleCase(item.status)} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Channel readiness</h2>
            <Link href="/dashboard/marketing/social" className="text-xs font-semibold text-cyan-300">Manage social accounts</Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {data.channelReadiness.map((channel) => {
              const meta = CHANNEL_STATE_META[channel.state];
              return (
                <div key={channel.provider} className="rounded-control border border-border-muted bg-surface-page/40 p-4">
                  <p className="text-sm font-semibold">{channel.label}</p>
                  <div className="mt-2"><StatusBadge status={meta.status} label={meta.label} /></div>
                  {channel.state !== "not_connected" && (channel.displayName || channel.handle) && (
                    <p className="mt-2 text-xs text-text-tertiary">{channel.displayName ?? channel.handle}</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Audience overview</h2>
            <Link href="/dashboard/marketing/audiences" className="text-xs font-semibold text-cyan-300">View all</Link>
          </div>
          <p className="mt-4 text-xs uppercase tracking-wide text-text-tertiary">Total audiences: <span className="font-bold text-white">{data.audienceOverview.total}</span></p>
          {data.audienceOverview.latest.length === 0 ? (
            <EmptyState icon="◇" title="No audiences yet" description="Define lawful segments from existing business data." actionLabel="Create Audience" actionHref="/dashboard/marketing/audiences" compact className="mt-6" />
          ) : (
            <div className="mt-4 divide-y divide-border-muted">
              {data.audienceOverview.latest.map((audience) => (
                <div key={audience.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-semibold">{audience.name}</p>
                    <p className="mt-1 text-xs text-text-tertiary">{audience.estimatedCount === null ? "Count unavailable" : `${audience.estimatedCount.toLocaleString()} estimated`} · {formatDate(audience.updatedAt)}</p>
                  </div>
                  <StatusBadge status={audience.status} label={titleCase(audience.status)} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Approval queue</h2>
            <Link href="/dashboard/marketing/approvals" className="text-xs font-semibold text-cyan-300">View all</Link>
          </div>
          {data.approvalQueue.length === 0 ? (
            <EmptyState icon="✓" title="Nothing pending" description="Work submitted for review will appear here before anything can publish." compact className="mt-6" />
          ) : (
            <div className="mt-4 divide-y divide-border-muted">
              {data.approvalQueue.map((approval) => (
                <div key={approval.id} className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-semibold">{RESOURCE_TYPE_LABEL[approval.resourceType] ?? titleCase(approval.resourceType)}: {approval.resourceName ?? approval.resourceId}</p>
                    <p className="mt-1 text-xs text-text-tertiary">Requested by {approval.requesterName ?? "Unknown requester"} · {formatDateTime(approval.createdAt)}</p>
                  </div>
                  <StatusBadge status="pending" label="Pending" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Recent activity</h2>
          {data.recentActivity.length === 0 ? (
            <p className="mt-6 text-sm text-text-tertiary">No Marketing activity has been recorded yet.</p>
          ) : (
            <div className="mt-4 divide-y divide-border-muted">
              {data.recentActivity.map((event) => (
                <div key={event.id} className="py-3">
                  <p className="text-sm">{event.description ?? titleCase(event.action.split(".").pop() ?? event.action)}</p>
                  <p className="mt-1 text-xs text-text-tertiary">{formatDateTime(event.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 via-surface-card to-surface-card">
          <h2 className="text-lg font-bold">Ask Kuba Marketing</h2>
          <p className="mt-3 text-sm leading-6 text-text-tertiary">Kuba Marketing can ground campaign and content drafts in Business Brain data — pipeline-aware, channel-adapted, always labeled as a draft. Every draft remains subject to human review and approval.</p>
          <Link href="/dashboard/ai-employees" className="mt-5 inline-flex text-sm font-semibold text-cyan-300">Open AI Workforce →</Link>
        </Card>
      </section>
    </>
  );
}
