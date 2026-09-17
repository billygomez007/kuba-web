"use client";

import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import StatusBadge from "@/app/components/ui/StatusBadge";
import type { marketingChannelReadiness } from "@/lib/marketing/publishing-operations";
import { DataState, OperationsShell, dateLabel, useMarketingData, type JsonData } from "../OperationsUI";

type Data = { readiness: JsonData<ReturnType<typeof marketingChannelReadiness>> };
export default function MarketingSocialPage() {
  const { data, error, reload } = useMarketingData<Data>("/api/marketing/social-accounts");
  return <OperationsShell title="Channel Readiness" description="Connection records come from this business’s saved social accounts. A saved connected status does not establish that publishing is available. OAuth connection and publishing adapters are currently unavailable.">
    <div><Button variant="secondary" onClick={reload}>Refresh records</Button></div>
    <DataState error={error} loading={!data} reload={reload} />
    <div className="grid gap-4 md:grid-cols-2">{data?.readiness.map(channel => <Card key={channel.provider} className="space-y-4"><h2 className="text-lg font-bold capitalize">{channel.provider}</h2>{channel.accounts.length === 0 ? <p className="text-sm text-text-tertiary">Not connected · No account record saved.</p> : channel.accounts.map(account => <div key={account.id} className="space-y-2 border-t border-border-muted pt-3"><div className="flex flex-wrap justify-between gap-2"><h3 className="break-words font-semibold">{account.displayName}</h3><StatusBadge status={account.readinessState} label={account.readinessState.replaceAll("_", " ")} /></div>{account.handle && <p className="break-words text-sm text-text-tertiary">{account.handle}</p>}<p className="text-xs text-text-tertiary">Saved status: {account.status} · Connected: {dateLabel(account.connectedAt)} · Expires: {dateLabel(account.expiresAt)}</p></div>)}<p className="break-words text-sm text-warning">{channel.code}</p><p className="text-sm text-text-muted">Provider execution unavailable.</p></Card>)}</div>
  </OperationsShell>;
}
