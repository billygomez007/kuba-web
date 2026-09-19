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
  reviewedAt: string | Date | null;
  comment: string | null;
  createdAt: string | Date;
};

export type ContentOperationsData = {
  content: Row & {
    id: string;
    title: string;
    brief: string | null;
    contentType: string;
    status: string;
    approvalStatus: string;
    campaignId: string | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };
  campaign: (Row & {
    id: string;
    name: string;
    status: string;
  }) | null;
  variants: Row[];
  approvals: ApprovalRow[];
  publishJobs: Row[];
  assets: Row[];
  activity: Row[];
  socialAccounts: Row[];
  capabilities: {
    canManage: boolean;
    canReviewApprovals: boolean;
  };
  currentUserId: string;
};

type Tab =
  | "Overview"
  | "Variants"
  | "Approvals"
  | "Publishing"
  | "Assets"
  | "Activity";

const tabs: Tab[] = [
  "Overview",
  "Variants",
  "Approvals",
  "Publishing",
  "Assets",
  "Activity",
];

function displayValue(value: unknown, fallback = "Unavailable") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function titleCase(value: unknown) {
  return displayValue(value, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDate(value: unknown) {
  if (!value) return "Not set";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) return "Not set";

  return date.toLocaleString();
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-border-default bg-surface-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-control border border-border-muted bg-surface-page/40 px-4 py-5 text-sm text-text-tertiary">
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-card border border-border-default bg-surface-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-text-muted">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">{value}</p>
    </div>
  );
}

function Rows({
  rows,
  primary,
  secondary,
}: {
  rows: Row[];
  primary: (row: Row) => string;
  secondary: (row: Row) => string;
}) {
  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div
          key={String(row.id ?? index)}
          className="rounded-control border border-border-default bg-surface-page/30 p-4"
        >
          <p className="text-sm font-semibold">{primary(row)}</p>
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            {secondary(row)}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function ContentOperations({
  data,
}: {
  data: ContentOperationsData;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [variantChannel, setVariantChannel] = useState("instagram");
  const [variantText, setVariantText] = useState("");
  const [variantHeadline, setVariantHeadline] = useState("");
  const [editingVariantId, setEditingVariantId] = useState<string | null>(null);
  const [editingVariantText, setEditingVariantText] = useState("");
  const [publishVariantId, setPublishVariantId] = useState("");
  const [publishScheduledAt, setPublishScheduledAt] = useState("");
  const [publishSocialAccountId, setPublishSocialAccountId] = useState("");

  const { content } = data;

  async function submitForApproval() {
    if (pendingAction) return;

    setMutationError(null);
    setPendingAction("submit");

    try {
      const response = await fetch("/api/marketing/approvals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resourceType: "content",
          resourceId: content.id,
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to submit content for approval.",
        );
      }

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to submit content for approval.",
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

    setMutationError(null);
    setPendingAction(`${decision}:${approvalId}`);

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
          body?.error || "Unable to review content approval.",
        );
      }

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to review content approval.",
      );
    } finally {
      setPendingAction(null);
    }
  }


  async function createVariant() {
    if (pendingAction) return;

    setMutationError(null);
    setPendingAction("create-variant");

    try {
      const response = await fetch(
        `/api/marketing/content/${content.id}/variants`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            channel: variantChannel,
            headline: variantHeadline,
            text: variantText,
          }),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to create content variant.",
        );
      }

      setVariantHeadline("");
      setVariantText("");

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to create content variant.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function updateVariant(variantId: string) {
    if (pendingAction) return;

    setMutationError(null);
    setPendingAction(`update-variant:${variantId}`);

    try {
      const response = await fetch(
        `/api/marketing/content/${content.id}/variants/${variantId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: editingVariantText,
          }),
        },
      );

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to update content variant.",
        );
      }

      setEditingVariantId(null);
      setEditingVariantText("");

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to update content variant.",
      );
    } finally {
      setPendingAction(null);
    }
  }


  async function schedulePublishJob() {
    if (pendingAction) return;

    const variant = data.variants.find(
      (row) => String(row.id) === publishVariantId,
    );

    if (!variant) {
      setMutationError("Select a content variant to schedule.");
      return;
    }

    if (!publishScheduledAt) {
      setMutationError("Choose a publishing date and time.");
      return;
    }

    const scheduledAt = new Date(publishScheduledAt);

    if (Number.isNaN(scheduledAt.getTime())) {
      setMutationError("Choose a valid publishing date and time.");
      return;
    }

    setMutationError(null);
    setPendingAction("schedule-publish");

    try {
      const response = await fetch("/api/marketing/publish-jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contentItemId: content.id,
          contentVariantId: String(variant.id),
          campaignId: content.campaignId,
          channel: String(variant.channel),
          socialAccountId: publishSocialAccountId || null,
          scheduledAt: scheduledAt.toISOString(),
        }),
      });

      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          body?.error || "Unable to create publishing job.",
        );
      }

      setPublishScheduledAt("");

      router.refresh();
      window.location.reload();
    } catch (cause) {
      setMutationError(
        cause instanceof Error
          ? cause.message
          : "Unable to create publishing job.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const pendingApproval = data.approvals.find(
    (approval) => approval.status === "pending",
  );

  const canSubmit =
    data.capabilities.canManage &&
    content.approvalStatus !== "pending" &&
    content.approvalStatus !== "approved" &&
    !pendingApproval;

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1450px]">
        <Link
          href="/dashboard/marketing/content"
          className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70"
        >
          ← Content Studio
        </Link>

        <header className="mt-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-300/70">
              Kuba Marketing · Content Operations
            </p>

            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              {content.title}
            </h1>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-text-tertiary">
              {content.brief || "No brief has been provided for this content."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {data.capabilities.canManage ? (
              <Link
                href={`/dashboard/marketing/content/${content.id}/edit`}
                className="rounded-control border border-border-muted px-4 py-2.5 text-sm font-semibold"
              >
                Edit content
              </Link>
            ) : null}

            {canSubmit ? (
              <button
                type="button"
                disabled={pendingAction !== null}
                onClick={submitForApproval}
                className="rounded-control border border-cyan-300/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pendingAction === "submit"
                  ? "Submitting…"
                  : "Submit for approval"}
              </button>
            ) : null}
          </div>
        </header>

        {mutationError ? (
          <div className="mt-5 rounded-control border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {mutationError}
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Metric label="Type" value={titleCase(content.contentType)} />
          <Metric label="Status" value={titleCase(content.status)} />
          <Metric label="Approval" value={titleCase(content.approvalStatus)} />
          <Metric label="Variants" value={data.variants.length} />
          <Metric label="Publish jobs" value={data.publishJobs.length} />
        </div>

        <div className="mt-8 flex gap-2 overflow-x-auto border-b border-border-muted pb-3">
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`whitespace-nowrap rounded-control px-3 py-2 text-sm font-semibold transition ${
                tab === value
                  ? "bg-cyan-400 text-slate-950"
                  : "text-text-tertiary hover:bg-surface-card hover:text-white"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {tab === "Overview" && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="Content details">
                  <dl className="space-y-4 text-sm">
                    <div>
                      <dt className="text-text-muted">Content type</dt>
                      <dd className="mt-1 font-semibold">
                        {titleCase(content.contentType)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-text-muted">Created</dt>
                      <dd className="mt-1 font-semibold">
                        {formatDate(content.createdAt)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-text-muted">Last updated</dt>
                      <dd className="mt-1 font-semibold">
                        {formatDate(content.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                </Panel>

                <Panel title="Campaign">
                  {data.campaign ? (
                    <div>
                      <Link
                        href={`/dashboard/marketing/campaigns/${data.campaign.id}`}
                        className="text-base font-bold text-cyan-200 hover:underline"
                      >
                        {data.campaign.name}
                      </Link>
                      <p className="mt-2 text-sm text-text-tertiary">
                        Campaign status: {titleCase(data.campaign.status)}
                      </p>
                    </div>
                  ) : (
                    <Empty>This content is not assigned to a campaign.</Empty>
                  )}
                </Panel>
              </div>

              <Panel title="Channel readiness">
                {data.socialAccounts.length === 0 ? (
                  <Empty>
                    No persisted Marketing social accounts are connected for
                    this business.
                  </Empty>
                ) : (
                  <Rows
                    rows={data.socialAccounts}
                    primary={(row) =>
                      displayValue(
                        row.displayName,
                        titleCase(row.provider) || "Social account",
                      )
                    }
                    secondary={(row) =>
                      `${titleCase(row.provider)} · ${titleCase(row.status)}`
                    }
                  />
                )}
              </Panel>
            </>
          )}

          {tab === "Variants" && (
            <Panel title="Channel variants">
              {data.capabilities.canManage ? (
                <div className="mb-6 rounded-control border border-border-default bg-surface-page/30 p-4">
                  <h3 className="text-sm font-bold">Create channel variant</h3>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[180px_1fr]">
                    <select
                      value={variantChannel}
                      onChange={(event) =>
                        setVariantChannel(event.target.value)
                      }
                      className="rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                    >
                      {[
                        "facebook",
                        "instagram",
                        "linkedin",
                        "x",
                        "tiktok",
                        "youtube",
                        "telegram",
                        "email",
                        "whatsapp",
                        "website",
                        "other",
                      ].map((channel) => (
                        <option key={channel} value={channel}>
                          {titleCase(channel)}
                        </option>
                      ))}
                    </select>

                    <input
                      value={variantHeadline}
                      onChange={(event) =>
                        setVariantHeadline(event.target.value)
                      }
                      placeholder="Headline (optional)"
                      className="rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                    />
                  </div>

                  <textarea
                    value={variantText}
                    onChange={(event) =>
                      setVariantText(event.target.value)
                    }
                    rows={5}
                    placeholder="Write the channel-specific content..."
                    className="mt-3 w-full rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                  />

                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      disabled={
                        pendingAction !== null || !variantText.trim()
                      }
                      onClick={createVariant}
                      className="rounded-control bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {pendingAction === "create-variant"
                        ? "Creating…"
                        : "Create variant"}
                    </button>
                  </div>
                </div>
              ) : null}

              {data.variants.length === 0 ? (
                <Empty>
                  No channel variants exist yet. Variants are never fabricated.
                </Empty>
              ) : (
                <div className="space-y-3">
                  {data.variants.map((row, index) => {
                    const id = String(row.id ?? index);
                    const editing = editingVariantId === id;

                    return (
                      <div
                        key={id}
                        className="rounded-control border border-border-default bg-surface-page/30 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold">
                              {titleCase(row.channel)} ·{" "}
                              {titleCase(row.status)}
                            </p>

                            <p className="mt-1 text-xs text-text-tertiary">
                              {displayValue(row.headline, "No headline")}
                            </p>

                            {editing ? (
                              <textarea
                                value={editingVariantText}
                                onChange={(event) =>
                                  setEditingVariantText(
                                    event.target.value,
                                  )
                                }
                                rows={5}
                                className="mt-3 w-full rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                              />
                            ) : (
                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
                                {displayValue(row.text, "No variant copy")}
                              </p>
                            )}
                          </div>

                          {data.capabilities.canManage ? (
                            <div className="flex flex-wrap gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    disabled={
                                      pendingAction !== null ||
                                      !editingVariantText.trim()
                                    }
                                    onClick={() =>
                                      updateVariant(id)
                                    }
                                    className="rounded-control bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50"
                                  >
                                    {pendingAction ===
                                    `update-variant:${id}`
                                      ? "Saving…"
                                      : "Save"}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={pendingAction !== null}
                                    onClick={() => {
                                      setEditingVariantId(null);
                                      setEditingVariantText("");
                                    }}
                                    className="rounded-control border border-border-muted px-3 py-2 text-xs"
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  disabled={pendingAction !== null}
                                  onClick={() => {
                                    setEditingVariantId(id);
                                    setEditingVariantText(
                                      displayValue(row.text, ""),
                                    );
                                  }}
                                  className="rounded-control border border-border-muted px-3 py-2 text-xs font-semibold"
                                >
                                  Edit copy
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {tab === "Approvals" && (
            <Panel title="Content approvals">
              {data.approvals.length === 0 ? (
                <Empty>No content approval requests exist yet.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.approvals.map((approval) => {
                    const canReview =
                      data.capabilities.canReviewApprovals &&
                      approval.status === "pending" &&
                      approval.requestedByUserId !== data.currentUserId;

                    return (
                      <div
                        key={approval.id}
                        className="rounded-control border border-border-default bg-surface-page/30 p-4"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="text-sm font-semibold">
                              {titleCase(approval.status)}
                            </p>

                            <p className="mt-1 text-xs text-text-tertiary">
                              Requested {formatDate(approval.createdAt)}
                              {approval.reviewedAt
                                ? ` · Reviewed ${formatDate(
                                    approval.reviewedAt,
                                  )}`
                                : ""}
                            </p>

                            {approval.comment ? (
                              <p className="mt-2 text-xs leading-5 text-text-secondary">
                                {approval.comment}
                              </p>
                            ) : null}

                            {approval.status === "pending" &&
                            approval.requestedByUserId ===
                              data.currentUserId ? (
                              <p className="mt-2 text-xs text-text-tertiary">
                                Another authorized reviewer must review this
                                request.
                              </p>
                            ) : null}
                          </div>

                          {canReview ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  reviewApproval(approval.id, "approved")
                                }
                                className="rounded-control border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  reviewApproval(
                                    approval.id,
                                    "changes_requested",
                                  )
                                }
                                className="rounded-control border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50"
                              >
                                Request changes
                              </button>

                              <button
                                type="button"
                                disabled={pendingAction !== null}
                                onClick={() =>
                                  reviewApproval(approval.id, "rejected")
                                }
                                className="rounded-control border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          )}

          {tab === "Publishing" && (
            <Panel title="Publishing execution">
              {data.capabilities.canManage ? (
                <div className="mb-6 rounded-control border border-border-default bg-surface-page/30 p-4">
                  <h3 className="text-sm font-bold">
                    Schedule publishing job
                  </h3>

                  <p className="mt-2 text-xs leading-5 text-text-tertiary">
                    Scheduling creates a real Marketing publish job. It does
                    not claim that a provider successfully published the
                    content.
                  </p>

                  {data.variants.length === 0 ? (
                    <div className="mt-4">
                      <Empty>
                        Create a channel variant before scheduling publishing.
                      </Empty>
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid gap-3 lg:grid-cols-3">
                        <select
                          value={publishVariantId}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPublishVariantId(value);

                            const variant = data.variants.find(
                              (row) => String(row.id) === value,
                            );

                            const matchingAccount =
                              data.socialAccounts.find(
                                (account) =>
                                  String(account.provider) ===
                                    String(variant?.channel) &&
                                  String(account.status) === "connected",
                              );

                            setPublishSocialAccountId(
                              matchingAccount
                                ? String(matchingAccount.id)
                                : "",
                            );
                          }}
                          className="rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                        >
                          <option value="">Select variant</option>
                          {data.variants.map((row) => (
                            <option
                              key={String(row.id)}
                              value={String(row.id)}
                            >
                              {titleCase(row.channel)} ·{" "}
                              {displayValue(row.headline, "No headline")}
                            </option>
                          ))}
                        </select>

                        <input
                          type="datetime-local"
                          value={publishScheduledAt}
                          onChange={(event) =>
                            setPublishScheduledAt(event.target.value)
                          }
                          className="rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                        />

                        <select
                          value={publishSocialAccountId}
                          onChange={(event) =>
                            setPublishSocialAccountId(
                              event.target.value,
                            )
                          }
                          className="rounded-control border border-border-muted bg-surface-page px-3 py-2.5 text-sm"
                        >
                          <option value="">
                            No connected account selected
                          </option>

                          {data.socialAccounts
                            .filter(
                              (account) =>
                                String(account.status) === "connected",
                            )
                            .map((account) => (
                              <option
                                key={String(account.id)}
                                value={String(account.id)}
                              >
                                {displayValue(
                                  account.displayName,
                                  titleCase(account.provider),
                                )}{" "}
                                · {titleCase(account.provider)}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={
                            pendingAction !== null ||
                            !publishVariantId ||
                            !publishScheduledAt
                          }
                          onClick={schedulePublishJob}
                          className="rounded-control bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pendingAction === "schedule-publish"
                            ? "Scheduling…"
                            : "Schedule publishing"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ) : null}

              {data.publishJobs.length === 0 ? (
                <Empty>No publishing jobs exist for this content yet.</Empty>
              ) : (
                <div className="space-y-3">
                  {data.publishJobs.map((row, index) => (
                    <div
                      key={String(row.id ?? index)}
                      className="rounded-control border border-border-default bg-surface-page/30 p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold">
                            {titleCase(row.channel)} ·{" "}
                            {titleCase(row.status)}
                          </p>

                          <p className="mt-1 text-xs text-text-tertiary">
                            {row.scheduledAt
                              ? `Scheduled ${formatDate(row.scheduledAt)}`
                              : "Not scheduled"}
                          </p>
                        </div>

                        <span className="text-xs text-text-muted">
                          Attempts:{" "}
                          {Number(row.attemptCount ?? 0).toLocaleString()}
                        </span>
                      </div>

                      {row.failureCode ? (
                        <div className="mt-3 rounded-control border border-amber-300/20 bg-amber-300/[0.05] px-3 py-2 text-xs leading-5 text-amber-200">
                          {displayValue(
                            row.failureMessageSafe,
                            displayValue(
                              row.failureCode,
                              "Publishing blocked",
                            ),
                          )}
                        </div>
                      ) : row.publishedAt ? (
                        <div className="mt-3 text-xs text-emerald-200">
                          Published {formatDate(row.publishedAt)}
                        </div>
                      ) : (
                        <div className="mt-3 text-xs text-text-tertiary">
                          No provider execution result recorded.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {tab === "Assets" && (
            <Panel title="Campaign assets">
              {!data.campaign ? (
                <Empty>
                  This content has no campaign, so no campaign assets are linked.
                </Empty>
              ) : data.assets.length === 0 ? (
                <Empty>No persisted assets exist for this campaign.</Empty>
              ) : (
                <Rows
                  rows={data.assets}
                  primary={(row) => displayValue(row.name, "Asset")}
                  secondary={(row) =>
                    `${titleCase(row.assetType)} · ${displayValue(
                      row.mimeType,
                      "Unknown MIME type",
                    )}`
                  }
                />
              )}
            </Panel>
          )}

          {tab === "Activity" && (
            <Panel title="Content activity">
              {data.activity.length === 0 ? (
                <Empty>No Marketing activity has been recorded yet.</Empty>
              ) : (
                <Rows
                  rows={data.activity}
                  primary={(row) => titleCase(row.action)}
                  secondary={(row) =>
                    `${displayValue(
                      row.description,
                      "Marketing activity",
                    )} · ${formatDate(row.createdAt)}`
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
