"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Row = Record<string, unknown>;

type ApprovalRow = Row & {
  id: string;
  resourceType: string;
  resourceId: string;
  status: string;
  requestedByUserId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | Date | null;
  comment: string | null;
  createdAt: string | Date;
};

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  objective: string;
  campaignType: string;
  status: string;
  approvalStatus: string;
  targetAudienceId: string | null;
  offer: string | null;
  landingUrl: string | null;
  timezone: string | null;
  startAt: string | number | Date | null;
  endAt: string | number | Date | null;
  budgetAmount: number | null;
  budgetCurrency: string;
};

export type CampaignOperationsData = {
  campaign: Campaign;
  channels: Row[];
  audience: Row | null;
  audienceRules: Row[];
  content: Row[];
  variants: Row[];
  approvals: ApprovalRow[];
  publishJobs: Row[];
  attributions: Row[];
  metrics: Row[];
  activity: Row[];
  socialAccounts: Row[];
  capabilities: {
    canManage: boolean;
    canReviewApprovals: boolean;
  };
  currentUserId: string;
};

const tabs = [
  "Overview",
  "Channels",
  "Audience",
  "Content",
  "Calendar",
  "Approvals",
  "Publishing",
  "Attribution",
  "Analytics",
  "Activity",
] as const;

type Tab = (typeof tabs)[number];

function titleCase(value: unknown) {
  return String(value ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return "Not scheduled";

  const date = new Date(value as string | number | Date);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleString();
}

function displayValue(value: unknown, fallback = "Not provided") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border-default bg-surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-card border border-border-default bg-surface-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-bold">{value}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm leading-6 text-text-tertiary">
      {children}
    </p>
  );
}

function Status({ value }: { value: unknown }) {
  return (
    <span className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold capitalize text-cyan-200">
      {titleCase(value || "unknown")}
    </span>
  );
}

function Rows({
  rows,
  primary,
  secondary,
}: {
  rows: Row[];
  primary: (row: Row) => React.ReactNode;
  secondary: (row: Row) => React.ReactNode;
}) {
  return (
    <div className="divide-y divide-border-muted">
      {rows.map((row, index) => (
        <div
          key={String(row.id ?? index)}
          className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <div className="font-semibold">{primary(row)}</div>
            <div className="mt-1 break-words text-xs text-text-tertiary">
              {secondary(row)}
            </div>
          </div>
          {row.status ? <Status value={row.status} /> : null}
        </div>
      ))}
    </div>
  );
}

type LifecycleAction = {
  label: string;
  status?: string;
  approval?: boolean;
  destructive?: boolean;
};

function lifecycleActions(status: string): LifecycleAction[] {
  switch (status) {
    case "draft":
    case "planned":
      return [
        { label: "Submit for approval", approval: true },
        { label: "Cancel campaign", status: "cancelled", destructive: true },
      ];
    case "approved":
      return [
        { label: "Schedule campaign", status: "scheduled" },
        { label: "Cancel campaign", status: "cancelled", destructive: true },
      ];
    case "scheduled":
      return [
        { label: "Activate campaign", status: "active" },
        { label: "Pause campaign", status: "paused" },
        { label: "Cancel campaign", status: "cancelled", destructive: true },
      ];
    case "active":
      return [
        { label: "Pause campaign", status: "paused" },
        { label: "Complete campaign", status: "completed" },
        { label: "Cancel campaign", status: "cancelled", destructive: true },
      ];
    case "paused":
      return [
        { label: "Resume campaign", status: "active" },
        { label: "Complete campaign", status: "completed" },
        { label: "Cancel campaign", status: "cancelled", destructive: true },
      ];
    default:
      return [];
  }
}

export default function CampaignOperations({
  data,
}: {
  data: CampaignOperationsData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const { campaign } = data;

  const actions = data.capabilities.canManage
    ? lifecycleActions(campaign.status)
    : [];

  async function runLifecycleAction(action: LifecycleAction) {
    if (pendingAction) return;

    setMutationError(null);
    setPendingAction(action.label);

    try {
      const response = action.approval
        ? await fetch("/api/marketing/approvals", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              resourceType: "campaign",
              resourceId: campaign.id,
            }),
          })
        : await fetch(`/api/marketing/campaigns/${campaign.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              status: action.status,
            }),
          });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to update campaign lifecycle.",
        );
      }

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to update campaign lifecycle.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function reviewApproval(
    approvalId: string,
    decision: "approved" | "rejected" | "changes_requested",
  ) {
    if (pendingAction) return;

    const label =
      decision === "approved"
        ? "Approve"
        : decision === "rejected"
          ? "Reject"
          : "Request changes";

    setMutationError(null);
    setPendingAction(`${label}:${approvalId}`);

    try {
      const response = await fetch(`/api/marketing/approvals/${approvalId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: decision,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to review Marketing approval.",
        );
      }

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to review Marketing approval.",
      );
    } finally {
      setPendingAction(null);
    }
  }


  const scheduledVariants = data.variants.filter(
    (variant) => variant.scheduledAt,
  );

  const scheduledJobs = data.publishJobs.filter((job) => job.scheduledAt);

  const connectedAccounts = data.socialAccounts.filter(
    (account) => account.status === "connected",
  );

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1450px]">
        <Link
          href="/dashboard/marketing/campaigns"
          className="text-sm font-semibold text-cyan-300"
        >
          ← Campaigns
        </Link>

        <header className="mt-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
              Campaign Operations
            </p>
            <h1 className="mt-3 break-words text-4xl font-black tracking-[-0.04em] sm:text-5xl">
              {campaign.name}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-tertiary">
              {campaign.description || "No description provided."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Status value={campaign.status} />
            <span className="rounded-full border border-border-muted px-2.5 py-1 text-xs text-text-tertiary">
              Approval: {titleCase(campaign.approvalStatus)}
            </span>
            <Link
              href={`/dashboard/marketing/campaigns/${campaign.id}/edit`}
              className="rounded-control border border-border-muted px-4 py-2 text-sm font-semibold hover:border-border-strong"
            >
              Edit campaign
            </Link>
          </div>
        </header>

        {(actions.length > 0 || mutationError) && (
          <section className="mt-6 rounded-card border border-border-default bg-surface-card p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-bold">Campaign lifecycle</p>
                <p className="mt-1 text-xs leading-5 text-text-tertiary">
                  Available actions are determined by the campaign&apos;s
                  persisted lifecycle status.
                </p>
              </div>

              {actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {actions.map((action) => {
                    const busy = pendingAction === action.label;

                    return (
                      <button
                        key={action.label}
                        type="button"
                        disabled={pendingAction !== null}
                        onClick={() => runLifecycleAction(action)}
                        className={`rounded-control border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          action.destructive
                            ? "border-danger/40 text-danger hover:bg-danger/10"
                            : "border-cyan-300/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20"
                        }`}
                      >
                        {busy ? "Working…" : action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {mutationError && (
              <div className="mt-4 rounded-control border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                {mutationError}
              </div>
            )}
          </section>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Channels" value={data.channels.length} />
          <Stat label="Content" value={data.content.length} />
          <Stat label="Variants" value={data.variants.length} />
          <Stat
            label="Pending approvals"
            value={data.approvals.filter((item) => item.status === "pending").length}
          />
          <Stat label="Publish jobs" value={data.publishJobs.length} />
        </div>

        <nav className="mt-8 flex gap-2 overflow-x-auto border-b border-border-muted pb-2">
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`whitespace-nowrap rounded-control px-3 py-2 text-sm transition ${
                tab === value
                  ? "bg-cyan-400 font-bold text-slate-950"
                  : "text-text-tertiary hover:bg-surface-card hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "Overview" && (
            <div className="grid gap-5 lg:grid-cols-3">
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
                <Stat label="Objective" value={titleCase(campaign.objective)} />
                <Stat label="Type" value={titleCase(campaign.campaignType)} />
                <Stat
                  label="Audience"
                  value={
                    data.audience
                      ? displayValue(data.audience.name)
                      : "Not assigned"
                  }
                />
                <Stat label="Start" value={formatDate(campaign.startAt)} />
                <Stat label="End" value={formatDate(campaign.endAt)} />
                <Stat
                  label="Timezone"
                  value={campaign.timezone || "Not provided"}
                />
              </div>

              <Panel title="Execution readiness">
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-text-tertiary">Connected accounts</span>
                    <strong>
                      {connectedAccounts.length}/{data.socialAccounts.length}
                    </strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-tertiary">Scheduled variants</span>
                    <strong>{scheduledVariants.length}</strong>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-text-tertiary">Scheduled jobs</span>
                    <strong>{scheduledJobs.length}</strong>
                  </div>
                  <p className="border-t border-border-muted pt-4 text-xs leading-5 text-text-muted">
                    Provider execution is shown only when persisted connection
                    and publishing records exist. No provider performance is
                    inferred.
                  </p>
                </div>
              </Panel>

              <Panel title="Offer">
                <Empty>{campaign.offer || "No campaign offer has been recorded."}</Empty>
              </Panel>

              <Panel title="Landing page">
                {campaign.landingUrl ? (
                  <a
                    href={campaign.landingUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-sm font-semibold text-cyan-300"
                  >
                    {campaign.landingUrl}
                  </a>
                ) : (
                  <Empty>No landing page has been recorded.</Empty>
                )}
              </Panel>

              <Panel title="Budget">
                <Empty>
                  {campaign.budgetAmount === null
                    ? "No campaign budget has been recorded."
                    : `${campaign.budgetCurrency} ${campaign.budgetAmount.toLocaleString()}`}
                </Empty>
              </Panel>
            </div>
          )}

          {tab === "Channels" && (
            <Panel title="Campaign channels">
              {data.channels.length === 0 ? (
                <Empty>
                  No persisted campaign channels are available yet.
                </Empty>
              ) : (
                <Rows
                  rows={data.channels}
                  primary={(row) => titleCase(row.channel)}
                  secondary={(row) =>
                    `Schedule: ${formatDate(row.scheduledStart)} → ${formatDate(
                      row.scheduledEnd,
                    )}${row.objectiveOverride ? ` · ${titleCase(row.objectiveOverride)}` : ""}`
                  }
                />
              )}

              <div className="mt-8 border-t border-border-muted pt-6">
                <h3 className="text-sm font-bold">Channel connections</h3>
                {data.socialAccounts.length === 0 ? (
                  <p className="mt-3 text-xs text-text-tertiary">
                    No persisted social account connections are available.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {data.socialAccounts.map((account, index) => (
                      <div
                        key={String(account.id ?? index)}
                        className="rounded-control border border-border-muted p-4"
                      >
                        <p className="font-semibold">
                          {displayValue(account.displayName)}
                        </p>
                        <p className="mt-1 text-xs text-text-tertiary">
                          {titleCase(account.provider)}
                          {account.handle ? ` · ${account.handle}` : ""}
                        </p>
                        <div className="mt-3">
                          <Status value={account.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {tab === "Audience" && (
            <Panel title="Target audience">
              {!data.audience ? (
                <Empty>No audience is assigned to this campaign.</Empty>
              ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold">
                        {displayValue(data.audience.name)}
                      </p>
                      <p className="mt-1 text-sm text-text-tertiary">
                        {displayValue(
                          data.audience.description,
                          "No audience description.",
                        )}
                      </p>
                    </div>
                    <Status value={data.audience.status} />
                  </div>

                  <p className="mt-5 text-xs text-text-tertiary">
                    Estimated count:{" "}
                    <strong className="text-white">
                      {data.audience.estimatedCount === null ||
                      data.audience.estimatedCount === undefined
                        ? "Unavailable"
                        : Number(data.audience.estimatedCount).toLocaleString()}
                    </strong>
                  </p>

                  <div className="mt-6 border-t border-border-muted pt-5">
                    <h3 className="text-sm font-bold">Audience rules</h3>
                    {data.audienceRules.length === 0 ? (
                      <p className="mt-3 text-xs text-text-tertiary">
                        No persisted audience rules are available.
                      </p>
                    ) : (
                      <Rows
                        rows={data.audienceRules}
                        primary={(row) => displayValue(row.field)}
                        secondary={(row) =>
                          `${titleCase(row.operator)} · ${displayValue(row.value)}`
                        }
                      />
                    )}
                  </div>
                </>
              )}
            </Panel>
          )}

          {tab === "Content" && (
            <Panel
              title="Campaign content"
              action={
                <Link
                  href="/dashboard/marketing/content/new"
                  className="text-xs font-semibold text-cyan-300"
                >
                  Create content
                </Link>
              }
            >
              {data.content.length === 0 ? (
                <Empty>No content is assigned to this campaign yet.</Empty>
              ) : (
                <div className="space-y-5">
                  {data.content.map((item, index) => {
                    const itemVariants = data.variants.filter(
                      (variant) => variant.contentItemId === item.id,
                    );

                    return (
                      <div
                        key={String(item.id ?? index)}
                        className="rounded-control border border-border-muted p-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <Link
                              href={`/dashboard/marketing/content/${String(item.id)}`}
                              className="font-semibold hover:text-cyan-300"
                            >
                              {displayValue(item.title)}
                            </Link>
                            <p className="mt-1 text-xs text-text-tertiary">
                              {titleCase(item.contentType)} · Approval:{" "}
                              {titleCase(item.approvalStatus)}
                            </p>
                          </div>
                          <Status value={item.status} />
                        </div>

                        {itemVariants.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            {itemVariants.map((variant) => (
                              <span
                                key={String(variant.id)}
                                className="rounded-full border border-border-muted px-2.5 py-1 text-xs text-text-tertiary"
                              >
                                {titleCase(variant.channel)} ·{" "}
                                {titleCase(variant.status)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {tab === "Calendar" && (
            <Panel title="Campaign schedule">
              {scheduledVariants.length === 0 && scheduledJobs.length === 0 ? (
                <Empty>No scheduled content or publish jobs exist yet.</Empty>
              ) : (
                <div className="space-y-7">
                  {scheduledVariants.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold">Scheduled variants</h3>
                      <Rows
                        rows={scheduledVariants}
                        primary={(row) => titleCase(row.channel)}
                        secondary={(row) => formatDate(row.scheduledAt)}
                      />
                    </div>
                  )}

                  {scheduledJobs.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold">Publish jobs</h3>
                      <Rows
                        rows={scheduledJobs}
                        primary={(row) => titleCase(row.channel)}
                        secondary={(row) => formatDate(row.scheduledAt)}
                      />
                    </div>
                  )}
                </div>
              )}
            </Panel>
          )}

          {tab === "Approvals" && (
            <Panel title="Campaign & content approvals">
              {data.approvals.length === 0 ? (
                <Empty>No campaign or content approval requests exist yet.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.approvals.map((row) => {
                    const canReview =
                      data.capabilities.canReviewApprovals &&
                      row.status === "pending" &&
                      row.requestedByUserId !== data.currentUserId;

                    return (
                      <div
                        key={row.id}
                        className="rounded-control border border-border-default bg-surface-card p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              {titleCase(row.resourceType)}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-text-tertiary">
                              {titleCase(row.status)} · Requested{" "}
                              {formatDate(row.createdAt)}
                              {row.reviewedAt
                                ? ` · Reviewed ${formatDate(row.reviewedAt)}`
                                : ""}
                            </p>

                            {row.comment ? (
                              <p className="mt-2 text-xs leading-5 text-text-secondary">
                                {displayValue(row.comment)}
                              </p>
                            ) : null}

                            {row.status === "pending" &&
                            row.requestedByUserId === data.currentUserId ? (
                              <p className="mt-2 text-xs text-text-tertiary">
                                You requested this approval, so another authorized
                                reviewer must review it.
                              </p>
                            ) : null}
                          </div>

                          {canReview ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  reviewApproval(row.id, "approved")
                                }
                                className="rounded-control border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingAction === `Approve:${row.id}`
                                  ? "Working…"
                                  : "Approve"}
                              </button>

                              <button
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  reviewApproval(row.id, "changes_requested")
                                }
                                className="rounded-control border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingAction === `Request changes:${row.id}`
                                  ? "Working…"
                                  : "Request changes"}
                              </button>

                              <button
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  reviewApproval(row.id, "rejected")
                                }
                                className="rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {pendingAction === `Reject:${row.id}`
                                  ? "Working…"
                                  : "Reject"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {mutationError ? (
                <div className="mt-4 rounded-control border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                  {mutationError}
                </div>
              ) : null}
            </Panel>
          )}

          {tab === "Publishing" && (
            <Panel title="Publishing operations">
              {data.publishJobs.length === 0 ? (
                <Empty>
                  No publish jobs exist. Provider publishing is not assumed or
                  simulated.
                </Empty>
              ) : (
                <Rows
                  rows={data.publishJobs}
                  primary={(row) => titleCase(row.channel)}
                  secondary={(row) =>
                    `${row.scheduledAt ? formatDate(row.scheduledAt) : "Not scheduled"}${
                      row.failureMessageSafe
                        ? ` · ${displayValue(row.failureMessageSafe)}`
                        : ""
                    }`
                  }
                />
              )}
            </Panel>
          )}

          {tab === "Attribution" && (
            <Panel title="Campaign attribution">
              {data.attributions.length === 0 ? (
                <Empty>No persisted attribution events exist yet.</Empty>
              ) : (
                <Rows
                  rows={data.attributions}
                  primary={(row) => titleCase(row.eventType)}
                  secondary={(row) =>
                    `${formatDate(row.occurredAt)}${
                      row.value !== null && row.value !== undefined
                        ? ` · ${displayValue(row.currency, "")} ${Number(row.value).toLocaleString()}`
                        : ""
                    }`
                  }
                />
              )}
            </Panel>
          )}

          {tab === "Analytics" && (
            <Panel title="Persisted campaign metrics">
              {data.metrics.length === 0 ? (
                <Empty>
                  No campaign metric snapshots exist yet. Provider reach,
                  impressions, CTR, CPC, ROAS, engagement, and similar metrics
                  are not invented.
                </Empty>
              ) : (
                <Rows
                  rows={data.metrics}
                  primary={(row) => titleCase(row.metric)}
                  secondary={(row) =>
                    `${Number(row.value ?? 0).toLocaleString()}${
                      row.currency ? ` ${displayValue(row.currency)}` : ""
                    } · ${formatDate(row.capturedAt)}`
                  }
                />
              )}
            </Panel>
          )}

          {tab === "Activity" && (
            <Panel title="Campaign activity">
              {data.activity.length === 0 ? (
                <Empty>No Marketing activity has been recorded yet.</Empty>
              ) : (
                <Rows
                  rows={data.activity}
                  primary={(row) => titleCase(row.action)}
                  secondary={(row) =>
                    `${displayValue(row.description, "Marketing activity")} · ${formatDate(
                      row.createdAt,
                    )}`
                  }
                />
              )}
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}
