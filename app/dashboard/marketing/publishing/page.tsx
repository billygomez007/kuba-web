"use client";

import { useState } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import StatusBadge from "@/app/components/ui/StatusBadge";
import type { getMarketingPublishingOperations } from "@/lib/marketing/publishing-operations";
import { DataState, Empty, OperationsShell, ResourceLink, dateLabel, fieldClass, useMarketingData, type JsonData } from "../OperationsUI";

type Data = { jobs: JsonData<Awaited<ReturnType<typeof getMarketingPublishingOperations>>> };
export default function MarketingPublishingPage() {
  const { data, error, reload } = useMarketingData<Data>("/api/marketing/publish-jobs");
  const [status, setStatus] = useState("all");
  const jobs = data?.jobs.filter(job => status === "all" || job.status === status) ?? [];
  return <OperationsShell title="Publishing operations" description="Inspect persisted scheduling intent and provider results. Publishing adapters are unavailable; queued or scheduled records do not mean a post was sent. No provider retries are available.">
    <div className="flex flex-wrap items-end gap-3"><label className="text-sm">Job status<select className={fieldClass} value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Array.from(new Set(data?.jobs.map(job => job.status) ?? [])).sort().map(value => <option key={value} value={value}>{value}</option>)}</select></label><Button variant="secondary" onClick={reload}>Refresh</Button><Button href="/dashboard/marketing/content" variant="secondary">Open content to schedule</Button></div>
    <DataState error={error} loading={!data} reload={reload} />
    {data && jobs.length === 0 && <Empty>No publishing jobs match this view.</Empty>}
    {jobs.map(job => <Card key={job.id} className="space-y-4">
      <div className="flex flex-wrap justify-between gap-3">{job.content ? <ResourceLink href={`/dashboard/marketing/content/${encodeURIComponent(job.content.id)}`}>{job.content.title}</ResourceLink> : <h2 className="font-semibold">Content unavailable</h2>}<StatusBadge status={job.status} /></div>
      <p className="text-sm text-text-tertiary">{job.channel} · {job.variant?.headline || "No variant headline recorded"} · {job.socialAccount?.displayName || "No account selected"}</p>
      {job.campaign && <ResourceLink href={`/dashboard/marketing/campaigns/${encodeURIComponent(job.campaign.id)}`}>{job.campaign.name}</ResourceLink>}
      <dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-text-muted">Scheduled</dt><dd>{dateLabel(job.scheduledAt)}</dd></div><div><dt className="text-text-muted">Attempts recorded</dt><dd>{job.attemptCount}</dd></div><div><dt className="text-text-muted">Provider post ID</dt><dd className="break-all">{job.providerPostId ?? "Not recorded"}</dd></div><div><dt className="text-text-muted">Published</dt><dd>{dateLabel(job.publishedAt)}</dd></div></dl>
      {job.failureCode && <p className="break-words text-sm text-warning">{job.failureCode}: {job.failureMessageSafe || "No further detail recorded."}</p>}
      {!job.providerPostId && !job.publishedAt && <p className="text-sm text-text-muted">No provider execution result recorded.</p>}
      <p className="break-all text-xs text-text-muted">Job {job.id} · Updated {dateLabel(job.updatedAt)}</p>
    </Card>)}
  </OperationsShell>;
}
