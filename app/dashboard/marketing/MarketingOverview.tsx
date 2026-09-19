/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Card from "@/app/components/ui/Card";
import MetricCard from "@/app/components/ui/MetricCard";
import StatusBadge, {
  type SemanticStatus,
} from "@/app/components/ui/StatusBadge";
import LoadingState from "@/app/components/ui/LoadingState";
import ErrorState, {
  type ErrorVariant,
} from "@/app/components/ui/ErrorState";
import EmptyState from "@/app/components/EmptyState";

type IsoDate = string;

type OverviewUpcomingActivity = {
  id: string;
  type:
    | "campaign_start"
    | "campaign_end"
    | "content_scheduled"
    | "publish_job";
  at: IsoDate;
  title: string;
  channel: string | null;
  status: string;
  campaignId: string | null;
};

type MarketingAIActivity = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: IsoDate;
};

type PublishAlert = {
  id: string;
  title: string;
  channel: string;
  status: string;
  failureCode: string | null;
  failureMessage: string | null;
  updatedAt: IsoDate;
};

type SalesAttribution = {
  id: string;
  campaignId: string;
  campaignName: string | null;
  leadId: string | null;
  customerId: string | null;
  dealId: string | null;
  eventType: string;
  occurredAt: IsoDate;
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
  recentCampaigns: {
    id: string;
    name: string;
    objective: string;
    status: string;
    startAt: IsoDate | null;
    endAt: IsoDate | null;
  }[];
  recentContent: {
    id: string;
    title: string;
    contentType: string;
    status: string;
    approvalStatus: string;
    updatedAt: IsoDate;
  }[];
  channelReadiness: {
    provider: string;
    label: string;
    state:
      | "connected"
      | "not_connected"
      | "needs_attention"
      | "expired"
      | "disabled";
    displayName: string | null;
    handle: string | null;
  }[];
  audienceOverview: {
    total: number;
    latest: {
      id: string;
      name: string;
      status: string;
      estimatedCount: number | null;
      updatedAt: IsoDate;
    }[];
  };
  approvalQueue: {
    id: string;
    resourceType: string;
    resourceId: string;
    resourceName: string | null;
    requesterName: string | null;
    createdAt: IsoDate;
    status: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    description: string | null;
    createdAt: IsoDate;
  }[];
  marketingAIActivity: MarketingAIActivity[];
  publishAlerts: PublishAlert[];
  salesAttributions: SalesAttribution[];
  needsAttentionCount: number;
};

const UPCOMING_TYPE_LABEL: Record<
  OverviewUpcomingActivity["type"],
  string
> = {
  campaign_start: "Campaign start",
  campaign_end: "Campaign end",
  content_scheduled: "Content scheduled",
  publish_job: "Publish job",
};

const CHANNEL_STATE_META: Record<
  OverviewData["channelReadiness"][number]["state"],
  { label: string; status: SemanticStatus }
> = {
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

const WORKSPACE_SECTIONS = [
  [
    "Campaigns",
    "/dashboard/marketing/campaigns",
    "Plan and monitor tenant-scoped campaigns.",
  ],
  [
    "Content Studio",
    "/dashboard/marketing/content",
    "Prepare channel-specific drafts for review.",
  ],
  [
    "Content Calendar",
    "/dashboard/marketing/calendar",
    "See planned internal marketing activity.",
  ],
  [
    "Audiences",
    "/dashboard/marketing/audiences",
    "Define lawful segments from existing business data.",
  ],
  [
    "Assets",
    "/dashboard/marketing/assets",
    "Manage reusable marketing assets.",
  ],
  [
    "Approvals",
    "/dashboard/marketing/approvals",
    "Review work before anything can publish.",
  ],
  [
    "Publishing",
    "/dashboard/marketing/publishing",
    "Inspect scheduling and persisted publishing results.",
  ],
  [
    "Channel Readiness",
    "/dashboard/marketing/social",
    "Inspect real channel connection state.",
  ],
  [
    "Analytics",
    "/dashboard/marketing/analytics",
    "Native counts only; no invented provider metrics.",
  ],
] as const;

function titleCase(value: string): string {
  return value
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

function attributionTarget(item: SalesAttribution): string {
  if (item.dealId) return "Deal";
  if (item.leadId) return "Lead";
  if (item.customerId) return "Customer";
  return "CRM";
}

export default function MarketingOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorVariant, setErrorVariant] =
    useState<ErrorVariant>("inline");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    fetch("/api/marketing/overview", {
      cache: "no-store",
    })
      .then(async (response) => {
        const body = await response.json();

        if (!response.ok) {
          setErrorVariant(
            response.status === 401 || response.status === 403
              ? "permission"
              : "inline",
          );

          throw new Error(
            body.error || "Unable to load the Marketing overview.",
          );
        }

        setData(body.overview);
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Unable to load the Marketing overview.",
        ),
      )
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
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
              Marketing command center
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">
              Kuba Marketing
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-tertiary">
              See what Kuba Marketing is doing for your business right
              now — campaigns, AI work, approvals, publishing,
              channels, scheduled activity, and CRM attribution.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard/marketing/content/new"
              className="rounded-control border border-border-default bg-surface-card px-4 py-2.5 text-sm font-semibold text-white hover:border-border-strong"
            >
              Create Content
            </Link>

            <Link
              href="/dashboard/marketing/campaigns/new"
              className="rounded-control bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"
            >
              Create Campaign
            </Link>
          </div>
        </header>

        {loading ? (
          <div className="mt-8">
            <LoadingState
              variant="panel"
              message="Loading Kuba Marketing activity…"
            />
          </div>
        ) : error ? (
          <div className="mt-8">
            <ErrorState
              variant={errorVariant}
              message={error}
              onRetry={load}
            />
          </div>
        ) : data ? (
          <OverviewBody data={data} />
        ) : null}

        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-text-muted">
            Marketing workspace
          </h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WORKSPACE_SECTIONS.map(([label, href, body]) => (
              <Link
                key={href}
                href={href}
                className="rounded-card border border-border-default bg-surface-card p-5 transition hover:border-border-strong"
              >
                <h3 className="font-semibold">{label}</h3>
                <p className="mt-2 text-sm leading-5 text-text-tertiary">
                  {body}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function OverviewBody({ data }: { data: OverviewData }) {
  const connectedChannels = data.channelReadiness.filter(
    (channel) => channel.state === "connected",
  ).length;

  return (
    <>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <MetricCard
          label="Active Campaigns"
          value={data.summary.activeCampaigns}
          href="/dashboard/marketing/campaigns"
        />

        <MetricCard
          label="Content"
          value={data.summary.contentPieces}
          href="/dashboard/marketing/content"
        />

        <MetricCard
          label="Scheduled"
          value={data.summary.scheduledContent}
          href="/dashboard/marketing/calendar"
        />

        <MetricCard
          label="Awaiting Approval"
          value={data.summary.pendingApprovals}
          href="/dashboard/marketing/approvals"
        />

        <MetricCard
          label="Leads Attributed"
          value={data.summary.leadsAttributed}
          href="/dashboard/marketing/analytics"
        />

        <MetricCard
          label="Channels Connected"
          value={connectedChannels}
          href="/dashboard/marketing/social"
        />

        <MetricCard
          label="Needs Attention"
          value={data.needsAttentionCount}
          href="/dashboard/marketing/publishing"
        />
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
        <Card className="overflow-hidden">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
                AI employee activity
              </p>
              <h2 className="mt-2 text-xl font-black">
                Kuba Marketing is working
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-text-tertiary">
                Real activity recorded for your Marketing AI employee.
                Drafts and recommendations remain subject to your
                approval rules.
              </p>
            </div>

            <Link
              href="/dashboard/ai-employees"
              className="text-xs font-semibold text-cyan-300"
            >
              Open AI Workforce
            </Link>
          </div>

          {data.marketingAIActivity.length === 0 ? (
            <EmptyState
              icon="✦"
              title="No Marketing AI activity yet"
              description="When Kuba Marketing creates or processes real marketing work, its recorded activity will appear here."
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-6 divide-y divide-border-muted">
              {data.marketingAIActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold">
                        {activity.title}
                      </p>

                      <StatusBadge
                        status={activity.status}
                        label={titleCase(activity.status)}
                      />
                    </div>

                    {activity.description ? (
                      <p className="mt-2 text-sm leading-5 text-text-tertiary">
                        {activity.description}
                      </p>
                    ) : null}

                    <p className="mt-2 text-xs text-text-muted">
                      {activity.employeeName} ·{" "}
                      {titleCase(activity.type)}
                    </p>
                  </div>

                  <time className="shrink-0 text-xs text-text-muted">
                    {formatDateTime(activity.createdAt)}
                  </time>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          className={
            data.needsAttentionCount > 0
              ? "border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-surface-card to-surface-card"
              : ""
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-300/80">
                Operations
              </p>
              <h2 className="mt-2 text-xl font-black">
                Needs Attention
              </h2>
            </div>

            <span className="rounded-full border border-border-muted px-3 py-1 text-sm font-black">
              {data.needsAttentionCount}
            </span>
          </div>

          {data.needsAttentionCount === 0 ? (
            <div className="mt-6 rounded-control border border-border-muted bg-surface-page/30 p-5">
              <p className="text-sm font-semibold">
                No immediate blockers
              </p>
              <p className="mt-2 text-sm leading-5 text-text-tertiary">
                No failed publishing jobs, pending approvals, or
                connected-channel issues currently need attention.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-3">
                {data.summary.pendingApprovals > 0 ? (
                  <Link
                    href="/dashboard/marketing/approvals"
                    className="block rounded-control border border-border-muted bg-surface-page/40 p-4 hover:border-border-strong"
                  >
                    <p className="text-sm font-semibold">
                      {data.summary.pendingApprovals} approval
                      {data.summary.pendingApprovals === 1 ? "" : "s"}{" "}
                      waiting
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      Human review is required before protected work can
                      proceed.
                    </p>
                  </Link>
                ) : null}

                {data.publishAlerts.slice(0, 4).map((alert) => (
                  <Link
                    key={alert.id}
                    href="/dashboard/marketing/publishing"
                    className="block rounded-control border border-border-muted bg-surface-page/40 p-4 hover:border-border-strong"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">
                        {alert.title}
                      </p>
                      <StatusBadge status="danger" label="Failed" />
                    </div>

                    <p className="mt-2 text-xs text-text-tertiary">
                      {titleCase(alert.channel)}
                      {alert.failureMessage
                        ? ` · ${alert.failureMessage}`
                        : alert.failureCode
                          ? ` · ${titleCase(alert.failureCode)}`
                          : ""}
                    </p>
                  </Link>
                ))}

                {data.channelReadiness
                  .filter(
                    (channel) =>
                      channel.state === "needs_attention" ||
                      channel.state === "expired" ||
                      channel.state === "disabled",
                  )
                  .slice(0, 3)
                  .map((channel) => (
                    <Link
                      key={channel.provider}
                      href="/dashboard/marketing/social"
                      className="block rounded-control border border-border-muted bg-surface-page/40 p-4 hover:border-border-strong"
                    >
                      <p className="text-sm font-semibold">
                        {channel.label}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {
                          CHANNEL_STATE_META[channel.state]
                            .label
                        }
                      </p>
                    </Link>
                  ))}
              </div>

              <Link
                href="/dashboard/marketing/publishing"
                className="mt-5 inline-flex text-sm font-semibold text-cyan-300"
              >
                Review marketing operations →
              </Link>
            </>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">
                Live operations
              </p>
              <h2 className="mt-2 text-lg font-bold">
                Marketing Activity
              </h2>
            </div>
          </div>

          {data.recentActivity.length === 0 ? (
            <EmptyState
              icon="◌"
              title="No activity recorded yet"
              description="Real Marketing audit events will appear here as your team and Kuba Marketing work."
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-6">
              {data.recentActivity.map((event, index) => (
                <div
                  key={event.id}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  <div className="flex w-4 shrink-0 justify-center">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-cyan-300" />
                    {index < data.recentActivity.length - 1 ? (
                      <span className="absolute bottom-0 top-4 ml-px w-px bg-border-muted" />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {event.description ??
                        titleCase(
                          event.action.split(".").pop() ??
                            event.action,
                        )}
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {titleCase(event.action)} ·{" "}
                      {formatDateTime(event.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">
              Campaigns Running Now
            </h2>

            <Link
              href="/dashboard/marketing/campaigns"
              className="text-xs font-semibold text-cyan-300"
            >
              View all
            </Link>
          </div>

          {data.recentCampaigns.filter(
            (campaign) => campaign.status === "active",
          ).length === 0 ? (
            <EmptyState
              icon="◇"
              title="No active campaigns"
              description="Campaigns that are actively running will appear here."
              actionLabel="Create Campaign"
              actionHref="/dashboard/marketing/campaigns/new"
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-5 divide-y divide-border-muted">
              {data.recentCampaigns
                .filter(
                  (campaign) => campaign.status === "active",
                )
                .map((campaign) => (
                  <Link
                    key={campaign.id}
                    href={`/dashboard/marketing/campaigns/${campaign.id}`}
                    className="flex items-center justify-between gap-4 py-4 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {campaign.name}
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {titleCase(campaign.objective)}
                        {campaign.startAt
                          ? ` · ${formatDate(campaign.startAt)}`
                          : ""}
                      </p>
                    </div>

                    <StatusBadge
                      status="success"
                      label="Active"
                    />
                  </Link>
                ))}
            </div>
          )}

          {data.campaignActivity.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border-muted pt-5">
              {data.campaignActivity.map((bucket) => (
                <div
                  key={bucket.status}
                  className="rounded-control border border-border-muted bg-surface-page/40 px-3 py-2"
                >
                  <span className="text-sm font-black">
                    {bucket.count}
                  </span>
                  <span className="ml-2 text-xs text-text-tertiary">
                    {titleCase(bucket.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Approval Queue</h2>
            <Link
              href="/dashboard/marketing/approvals"
              className="text-xs font-semibold text-cyan-300"
            >
              Review approvals
            </Link>
          </div>

          {data.approvalQueue.length === 0 ? (
            <EmptyState
              icon="✓"
              title="Nothing pending"
              description="Work submitted for review will appear here before protected actions can proceed."
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-4 divide-y divide-border-muted">
              {data.approvalQueue.map((approval) => (
                <div
                  key={approval.id}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {RESOURCE_TYPE_LABEL[
                        approval.resourceType
                      ] ?? titleCase(approval.resourceType)}
                      :{" "}
                      {approval.resourceName ??
                        approval.resourceId}
                    </p>

                    <p className="mt-1 text-xs text-text-tertiary">
                      Requested by{" "}
                      {approval.requesterName ??
                        "Unknown requester"}{" "}
                      · {formatDateTime(approval.createdAt)}
                    </p>
                  </div>

                  <StatusBadge
                    status="pending"
                    label="Pending"
                  />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">
              Upcoming 7-Day Activity
            </h2>

            <Link
              href="/dashboard/marketing/calendar"
              className="text-xs font-semibold text-cyan-300"
            >
              Open calendar
            </Link>
          </div>

          {data.upcoming.length === 0 ? (
            <EmptyState
              icon="◔"
              title="Nothing scheduled"
              description="Campaign dates and scheduled publishing activity will appear here."
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-5 divide-y divide-border-muted">
              {data.upcoming.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs text-text-tertiary">
                      {formatDateTime(item.at)} ·{" "}
                      {UPCOMING_TYPE_LABEL[item.type]}
                      {item.channel
                        ? ` · ${titleCase(item.channel)}`
                        : ""}
                    </p>
                  </div>

                  <StatusBadge
                    status={item.status}
                    label={titleCase(item.status)}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">
                Channel Activity
              </h2>
              <p className="mt-1 text-xs text-text-tertiary">
                Actual persisted connection state only.
              </p>
            </div>

            <Link
              href="/dashboard/marketing/social"
              className="text-xs font-semibold text-cyan-300"
            >
              Manage channels
            </Link>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.channelReadiness.map((channel) => {
              const meta =
                CHANNEL_STATE_META[channel.state];

              return (
                <div
                  key={channel.provider}
                  className="rounded-control border border-border-muted bg-surface-page/40 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold">
                      {channel.label}
                    </p>

                    <StatusBadge
                      status={meta.status}
                      label={meta.label}
                    />
                  </div>

                  {channel.displayName || channel.handle ? (
                    <p className="mt-3 truncate text-xs text-text-tertiary">
                      {channel.displayName ??
                        channel.handle}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-text-muted">
                      No connected account
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">
                Marketing → CRM
              </h2>
              <p className="mt-1 text-xs text-text-tertiary">
                Persisted campaign attribution only.
              </p>
            </div>

            <Link
              href="/dashboard/marketing/analytics"
              className="text-xs font-semibold text-cyan-300"
            >
              Analytics
            </Link>
          </div>

          {data.salesAttributions.length === 0 ? (
            <EmptyState
              icon="↗"
              title="No CRM attribution yet"
              description="When a marketing campaign is linked to a lead, customer, or deal, that persisted attribution will appear here."
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-5 divide-y divide-border-muted">
              {data.salesAttributions.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/marketing/campaigns/${item.campaignId}`}
                  className="flex items-center justify-between gap-4 py-4 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.campaignName ??
                        "Marketing campaign"}
                    </p>

                    <p className="mt-1 text-xs text-text-tertiary">
                      {attributionTarget(item)} ·{" "}
                      {titleCase(item.eventType)} ·{" "}
                      {formatDateTime(item.occurredAt)}
                    </p>
                  </div>

                  <span className="text-xs font-semibold text-cyan-300">
                    View
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">
              Recent Content
            </h2>

            <Link
              href="/dashboard/marketing/content"
              className="text-xs font-semibold text-cyan-300"
            >
              View all
            </Link>
          </div>

          {data.recentContent.length === 0 ? (
            <EmptyState
              icon="◇"
              title="No content yet"
              description="Create content to prepare channel-specific drafts for review."
              actionLabel="Create Content"
              actionHref="/dashboard/marketing/content/new"
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-5 divide-y divide-border-muted">
              {data.recentContent.map((item) => (
                <Link
                  key={item.id}
                  href={`/dashboard/marketing/content/${item.id}`}
                  className="flex items-center justify-between gap-4 py-4 hover:opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {item.title}
                    </p>
                    <p className="mt-1 text-xs text-text-tertiary">
                      {titleCase(item.contentType)} · Approval:{" "}
                      {titleCase(item.approvalStatus)} ·{" "}
                      {formatDate(item.updatedAt)}
                    </p>
                  </div>

                  <StatusBadge
                    status={item.status}
                    label={titleCase(item.status)}
                  />
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 via-surface-card to-surface-card">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/70">
            Quick actions
          </p>

          <h2 className="mt-2 text-xl font-black">
            Keep Marketing moving
          </h2>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <QuickAction
              href="/dashboard/marketing/campaigns/new"
              title="Create campaign"
              body="Start a new native campaign."
            />
            <QuickAction
              href="/dashboard/marketing/content/new"
              title="Create content"
              body="Prepare a new draft."
            />
            <QuickAction
              href="/dashboard/marketing/audiences"
              title="Build audience"
              body="Create a lawful segment."
            />
            <QuickAction
              href="/dashboard/marketing/approvals"
              title="Review approvals"
              body="Inspect work awaiting review."
            />
            <QuickAction
              href="/dashboard/marketing/calendar"
              title="Open calendar"
              body="See scheduled activity."
            />
            <QuickAction
              href="/dashboard/ai-employees"
              title="Ask Kuba Marketing"
              body="Open your AI workforce."
            />
          </div>
        </Card>
      </section>

      <section className="mt-8">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">
                Audience Overview
              </h2>
              <p className="mt-1 text-xs text-text-tertiary">
                {data.audienceOverview.total} persisted audience
                {data.audienceOverview.total === 1 ? "" : "s"}.
              </p>
            </div>

            <Link
              href="/dashboard/marketing/audiences"
              className="text-xs font-semibold text-cyan-300"
            >
              View audiences
            </Link>
          </div>

          {data.audienceOverview.latest.length === 0 ? (
            <EmptyState
              icon="◇"
              title="No audiences yet"
              description="Define lawful segments from existing business data."
              actionLabel="Create Audience"
              actionHref="/dashboard/marketing/audiences"
              compact
              className="mt-6"
            />
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.audienceOverview.latest.map(
                (audience) => (
                  <div
                    key={audience.id}
                    className="rounded-control border border-border-muted bg-surface-page/40 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold">
                        {audience.name}
                      </p>

                      <StatusBadge
                        status={audience.status}
                        label={titleCase(
                          audience.status,
                        )}
                      />
                    </div>

                    <p className="mt-3 text-xs text-text-tertiary">
                      {audience.estimatedCount === null
                        ? "Audience count unavailable"
                        : `${audience.estimatedCount.toLocaleString()} estimated`}
                    </p>
                  </div>
                ),
              )}
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

function QuickAction({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-control border border-border-muted bg-surface-page/40 p-4 transition hover:border-cyan-300/40"
    >
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-text-tertiary">
        {body}
      </p>
    </Link>
  );
}
