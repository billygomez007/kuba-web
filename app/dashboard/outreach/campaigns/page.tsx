"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import LoadingState from "../../../components/ui/LoadingState";
import EmptyState from "../../../components/EmptyState";
import { CAMPAIGN_STATUS_LABEL, CAMPAIGN_STATUS_SEMANTIC, formatDate } from "./status-labels";

type CampaignMetrics = {
  enrolled: number;
  eligible: number;
  scheduled: number;
  sent: number;
  failed: number;
  suppressed: number;
  optedOut: number;
  replied: number;
  interested: number;
  handedOff: number;
  completed: number;
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  employeeId: string;
  employeeName: string | null;
  createdAt: string;
  scheduledAt: string | null;
  startedAt: string | null;
  metrics: CampaignMetrics;
};

export default function CampaignsListPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await fetch("/api/outreach/campaigns", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load campaigns.");
      setCampaigns(data.campaigns ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const totals = useMemo(
    () =>
      campaigns.reduce(
        (acc, campaign) => ({
          campaigns: acc.campaigns + 1,
          running: acc.running + (campaign.status === "running" ? 1 : 0),
          enrolled: acc.enrolled + campaign.metrics.enrolled,
          handedOff: acc.handedOff + campaign.metrics.handedOff,
        }),
        { campaigns: 0, running: 0, enrolled: 0, handedOff: 0 },
      ),
    [campaigns],
  );

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1450px]">
        <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">Kuba Outreach</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.04em]">Campaigns</h1>
            <p className="mt-3 max-w-2xl text-sm text-text-tertiary">
              Sequenced outreach campaigns to your saved Outreach contacts. Kuba Outreach can help prepare a campaign — launching
              it is always your call.
            </p>
          </div>
          <Button href="/dashboard/outreach/campaigns/new" variant="primary">
            + New campaign
          </Button>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-card border border-border-default bg-surface-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">Campaigns</p>
            <p className="mt-2 text-3xl font-black">{totals.campaigns}</p>
          </div>
          <div className="rounded-card border border-border-default bg-surface-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">Running now</p>
            <p className="mt-2 text-3xl font-black">{totals.running}</p>
          </div>
          <div className="rounded-card border border-border-default bg-surface-card p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">Recipients enrolled</p>
            <p className="mt-2 text-3xl font-black">{totals.enrolled}</p>
          </div>
        </section>

        <section className="mt-10">
          {loading ? (
            <div className="rounded-card border border-border-default bg-surface-card">
              <LoadingState message="Loading campaigns..." />
            </div>
          ) : error ? (
            <div className="rounded-card border border-border-default bg-surface-card p-6 text-sm text-danger">{error}</div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-card border border-border-default bg-surface-card">
              <EmptyState
                icon="▶"
                title="Create your first outreach campaign."
                description="Enroll saved Outreach contacts into a sequence and let Kuba Outreach help you prepare the content — you launch when it's ready."
                actionLabel="+ New campaign"
                actionHref="/dashboard/outreach/campaigns/new"
                compact
              />
            </div>
          ) : (
            <ul className="flex flex-col gap-4">
              {campaigns.map((campaign) => (
                <CampaignRow key={campaign.id} campaign={campaign} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const { metrics } = campaign;
  return (
    <li>
      <Link
        href={`/dashboard/outreach/campaigns/${campaign.id}`}
        className="block rounded-card border border-border-default bg-surface-card p-5 transition hover:border-border-strong hover:bg-surface-card-hover sm:p-6"
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="truncate text-lg font-bold text-white">{campaign.name}</h2>
              <StatusBadge status={CAMPAIGN_STATUS_SEMANTIC[campaign.status] ?? "neutral"} label={CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status} dot />
            </div>
            <p className="mt-1.5 text-xs text-text-tertiary">
              {campaign.employeeName ?? "Kuba Outreach"} · {campaign.channel === "email" ? "Email" : campaign.channel} · Created{" "}
              {formatDate(campaign.createdAt)}
              {campaign.scheduledAt ? ` · Scheduled for ${formatDate(campaign.scheduledAt)}` : ""}
              {campaign.startedAt ? ` · Started ${formatDate(campaign.startedAt)}` : ""}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-center sm:grid-cols-4 lg:grid-cols-8">
          <Metric label="Recipients" value={metrics.enrolled} />
          <Metric label="Scheduled" value={metrics.scheduled} />
          <Metric label="Sent" value={metrics.sent} />
          <Metric label="Replied" value={metrics.replied} />
          <Metric label="Interested" value={metrics.interested} />
          <Metric label="Handed off" value={metrics.handedOff} />
          <Metric label="Failed" value={metrics.failed} tone={metrics.failed > 0 ? "danger" : undefined} />
          <Metric label="Suppressed" value={metrics.suppressed + metrics.optedOut} />
        </div>
      </Link>
    </li>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className="rounded-control border border-border-muted bg-surface-page/40 px-2 py-3">
      <p className={`text-lg font-black ${tone === "danger" && value > 0 ? "text-danger" : "text-white"}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{label}</p>
    </div>
  );
}
