"use client";

import { useState } from "react";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import StatusBadge from "@/app/components/ui/StatusBadge";
import ErrorState from "@/app/components/ui/ErrorState";
import type { getMarketingApprovalCenter } from "@/lib/marketing/publishing-operations";
import { DataState, Empty, OperationsShell, ResourceLink, dateLabel, fieldClass, useMarketingData, type JsonData } from "../OperationsUI";

type Approval = JsonData<Awaited<ReturnType<typeof getMarketingApprovalCenter>>>[number];
type Data = { approvals: Approval[]; capabilities: { canReviewApprovals: boolean }; currentUserId: string };

export default function MarketingApprovalsPage() {
  const { data, error, reload } = useMarketingData<Data>("/api/marketing/approvals");
  const [view, setView] = useState("pending");
  const rows = data?.approvals.filter(row => view === "pending" ? row.status === "pending" : row.status !== "pending") ?? [];
  return <OperationsShell title="Approval Center" description="Review campaign and content requests, then follow the recorded decision history. Publishing remains subject to provider availability.">
    <div className="flex flex-wrap gap-3" role="group" aria-label="Approval history filter">
      <Button variant={view === "pending" ? "primary" : "secondary"} aria-pressed={view === "pending"} onClick={() => setView("pending")}>Pending ({data?.approvals.filter(row => row.status === "pending").length ?? "—"})</Button>
      <Button variant={view === "resolved" ? "primary" : "secondary"} aria-pressed={view === "resolved"} onClick={() => setView("resolved")}>Resolved history ({data?.approvals.filter(row => row.status !== "pending").length ?? "—"})</Button>
      <Button variant="ghost" onClick={reload}>Refresh</Button>
    </div>
    <DataState error={error} loading={!data} reload={reload} />
    {data && rows.length === 0 && <Empty>No {view === "pending" ? "pending requests" : "resolved approvals"} for this business.</Empty>}
    {data && rows.map(row => <ApprovalCard key={row.id} row={row} canReview={data.capabilities.canReviewApprovals && row.requestedByUserId !== data.currentUserId && row.status === "pending" && Boolean(row.resourceHref)} self={row.requestedByUserId === data.currentUserId} onReviewed={reload} />)}
  </OperationsShell>;
}

function ApprovalCard({ row, canReview, self, onReviewed }: { row: Approval; canReview: boolean; self: boolean; onReviewed: () => void }) {
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  async function review(status: string) {
    if (!canReview || pending) return;
    setPending(true); setError(undefined);
    try {
      const response = await fetch(`/api/marketing/approvals/${encodeURIComponent(row.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, comment }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to review this request.");
      onReviewed();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to review this request."); }
    finally { setPending(false); }
  }
  return <Card className="space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="mb-1 text-xs uppercase text-text-muted">{row.resourceType}</p>{row.resourceHref ? <ResourceLink href={row.resourceHref}>{row.resourceName}</ResourceLink> : <h2 className="font-semibold">Resource unavailable</h2>}</div><StatusBadge status={row.status} label={row.status.replaceAll("_", " ")} /></div>
    <p className="text-sm text-text-tertiary">Requested by {row.requesterName ?? "Name unavailable"} · {dateLabel(row.createdAt)}</p>
    {row.status !== "pending" && <div className="space-y-2 text-sm text-text-tertiary"><p>Reviewed by {row.reviewerName ?? "Name unavailable"} · {dateLabel(row.reviewedAt)}</p><p className="whitespace-pre-wrap break-words">{row.comment || "No review comment recorded."}</p></div>}
    {row.status === "pending" && !canReview && <p className="text-sm text-text-muted">{self ? "You cannot review your own request." : !row.resourceHref ? "The resource is unavailable for review." : "Review permission is required to decide this request."}</p>}
    {canReview && <div className="space-y-3"><label className="block text-sm">Review comment (optional)<textarea className={fieldClass} value={comment} onChange={event => setComment(event.target.value)} disabled={pending} rows={2} /></label><div className="flex flex-wrap gap-2"><Button disabled={pending} onClick={() => review("approved")}>Approve</Button><Button variant="secondary" disabled={pending} onClick={() => review("changes_requested")}>Request changes</Button><Button variant="danger" disabled={pending} onClick={() => review("rejected")}>Reject</Button></div>{pending && <p role="status" className="text-sm">Saving review…</p>}</div>}
    {error && <ErrorState message={error} />}
  </Card>;
}
