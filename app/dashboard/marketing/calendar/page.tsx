"use client";

import { useState, type FormEvent } from "react";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import StatusBadge from "@/app/components/ui/StatusBadge";
import type { getMarketingCalendar } from "@/lib/marketing/publishing-operations";
import { DataState, Empty, OperationsShell, ResourceLink, dateLabel, fieldClass, useMarketingData, type JsonData } from "../OperationsUI";

type Data = JsonData<Awaited<ReturnType<typeof getMarketingCalendar>>>;
export default function MarketingCalendarPage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  function filter(event: FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    setQuery(params.toString());
  }
  return <OperationsShell title="Marketing Calendar" description="Scheduled variants and publishing jobs in one chronological view. A job represents its linked variant once. Dates and day boundaries use UTC; displayed times use your local timezone. Scheduling records intent, not provider delivery.">
    <form onSubmit={filter} className="flex flex-wrap items-end gap-3"><label className="text-sm">From (UTC)<input type="date" className={fieldClass} value={from} onChange={event => setFrom(event.target.value)} /></label><label className="text-sm">Through (UTC)<input type="date" className={fieldClass} value={to} onChange={event => setTo(event.target.value)} /></label><Button type="submit">Apply dates</Button><Button variant="secondary" onClick={() => { setFrom(""); setTo(""); setQuery(""); }}>Clear dates</Button></form>
    <CalendarEntries key={query} query={query} />
  </OperationsShell>;
}
function CalendarEntries({ query }: { query: string }) {
  const { data, error, reload } = useMarketingData<Data>(`/api/marketing/calendar?${query}`);
  return <><DataState error={error} loading={!data} reload={reload} />{data && data.entries.length === 0 && <Empty>No scheduled activity in this date range.</Empty>}{data?.entries.map(entry => <Card key={entry.unitId} className="space-y-3"><div className="flex flex-wrap justify-between gap-3"><p className="font-semibold">{dateLabel(entry.scheduledAt)}</p><StatusBadge status={entry.status} /></div>{entry.content ? <ResourceLink href={`/dashboard/marketing/content/${encodeURIComponent(entry.content.id)}`}>{entry.content.title}</ResourceLink> : <p>Content unavailable</p>}<p className="text-sm text-text-tertiary">{entry.channel} · {entry.kind === "publish_job" ? "Publishing job" : "Scheduled variant"}</p>{entry.campaign && <ResourceLink href={`/dashboard/marketing/campaigns/${encodeURIComponent(entry.campaign.id)}`}>{entry.campaign.name}</ResourceLink>}{entry.failureCode && <p className="break-words text-sm text-warning">{entry.failureCode}: {entry.failureMessageSafe}</p>}</Card>)}</>;
}
