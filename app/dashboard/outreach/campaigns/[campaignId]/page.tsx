"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Button from "../../../../components/ui/Button";
import StatusBadge from "../../../../components/ui/StatusBadge";
import LoadingState from "../../../../components/ui/LoadingState";
import ErrorState from "../../../../components/ui/ErrorState";
import EmptyState from "../../../../components/EmptyState";
import Dialog from "../../../../components/ui/Dialog";
import FormField from "../../../../components/ui/FormField";
import {
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_STATUS_SEMANTIC,
  RECIPIENT_STATUS_LABEL,
  RECIPIENT_STATUS_SEMANTIC,
  formatDate,
  formatDateTime,
} from "../status-labels";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  channel: string;
  employeeId: string;
  employeeName: string | null;
  launchedBy: string | null;
  launchedAt: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  stoppedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

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

type SequenceStep = {
  id: string;
  stepNumber: number;
  delayHours: number;
  subjectTemplate: string | null;
  bodyTemplate: string;
};

type Recipient = {
  id: string;
  contactId: string;
  companyName: string | null;
  destinationChannel: string;
  destinationIdentity: string;
  displayName: string | null;
  status: string;
  currentStepNumber: number | null;
  nextSendAt: string | null;
  lastSentAt: string | null;
  lastReplyAt: string | null;
  suppressionReason: string | null;
  handoffLeadId: string | null;
  handedOffAt: string | null;
  handoffReasonLabel: string | null;
  handoffAssignedEmployeeName: string | null;
  enrolledAt: string;
};

type Contact = {
  contactId: string;
  name: string | null;
  email: string | null;
  companyName: string | null;
  qualificationStatus: string | null;
  icpFitScore: number | null;
  doNotContact: boolean;
  consentStatus: string;
  alreadyEnrolled: boolean;
  suppressed: boolean;
};

// "sent" is a transient recipient status (immediately resolved to "ready"
// or "completed" — see lib/outreach/process-send.ts) so it's not a
// meaningful filter value here; "completed" (finished the sequence) is
// the recipient-level equivalent of "successfully sent through".
const RECIPIENT_FILTERS = ["all", "scheduled", "completed", "replied", "handed_off", "failed", "suppressed"] as const;

function ratePercent(numerator: number, denominator: number): string | null {
  if (denominator <= 0) return null;
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export default function CampaignDetailPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [steps, setSteps] = useState<SequenceStep[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [recipientFilter, setRecipientFilter] = useState<(typeof RECIPIENT_FILTERS)[number]>("all");
  const [previewStepId, setPreviewStepId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [campaignRes, stepsRes, recipientsRes] = await Promise.all([
        fetch(`/api/outreach/campaigns/${campaignId}`, { cache: "no-store" }),
        fetch(`/api/outreach/campaigns/${campaignId}/sequence`, { cache: "no-store" }),
        fetch(`/api/outreach/campaigns/${campaignId}/recipients`, { cache: "no-store" }),
      ]);
      const campaignData = await campaignRes.json();
      if (!campaignRes.ok) throw new Error(campaignData.error || "Unable to load campaign.");
      const stepsData = await stepsRes.json();
      const recipientsData = await recipientsRes.json();

      setCampaign(campaignData.campaign);
      setMetrics(campaignData.metrics);
      setSteps(stepsData.steps ?? []);
      setRecipients(recipientsData.recipients ?? []);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load campaign.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function runAction(action: () => Promise<Response>) {
    setActionBusy(true);
    setActionError("");
    try {
      const response = await action();
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Action failed.");
      await load();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setActionBusy(false);
    }
  }

  if (loading) {
    return <LoadingState variant="page" message="Loading campaign..." />;
  }

  if (loadError || !campaign || !metrics) {
    return <ErrorState variant="page" message={loadError || "Campaign not found."} dashboardHref="/dashboard/outreach/campaigns" />;
  }

  const isDraft = campaign.status === "draft";
  const isScheduled = campaign.status === "scheduled";
  const isRunning = campaign.status === "running";
  const isPaused = campaign.status === "paused";
  const isReadOnlyHistory = ["completed", "stopped", "failed"].includes(campaign.status);

  const filteredRecipients =
    recipientFilter === "all"
      ? recipients
      : recipients.filter((recipient) => {
          if (recipientFilter === "handed_off") return recipient.status === "handed_off";
          if (recipientFilter === "suppressed") return recipient.status === "suppressed" || recipient.status === "opted_out";
          return recipient.status === recipientFilter;
        });

  return (
    <main className="min-h-screen bg-surface-page px-4 py-8 text-white sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1300px]">
        <Link href="/dashboard/outreach/campaigns" className="text-xs font-semibold text-text-tertiary hover:text-accent">
          ← Campaigns
        </Link>

        <header className="mt-4 flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-black tracking-[-0.03em]">{campaign.name}</h1>
              <StatusBadge
                status={CAMPAIGN_STATUS_SEMANTIC[campaign.status] ?? "neutral"}
                label={CAMPAIGN_STATUS_LABEL[campaign.status] ?? campaign.status}
                dot
              />
            </div>
            {campaign.description && <p className="mt-2 max-w-2xl text-sm text-text-tertiary">{campaign.description}</p>}
            <p className="mt-2 text-xs text-text-muted">
              {campaign.employeeName ?? "Kuba Outreach"} · Email · Created {formatDate(campaign.createdAt)}
            </p>
          </div>

          <LifecycleActions
            campaign={campaign}
            busy={actionBusy}
            onPause={() => runAction(() => fetch(`/api/outreach/campaigns/${campaignId}/pause`, { method: "POST" }))}
            onResume={() => runAction(() => fetch(`/api/outreach/campaigns/${campaignId}/resume`, { method: "POST" }))}
            onStop={() => runAction(() => fetch(`/api/outreach/campaigns/${campaignId}/stop`, { method: "POST" }))}
          />
        </header>

        {campaign.status === "failed" && campaign.failureReason && (
          <div className="mt-6 rounded-card border border-danger/25 bg-danger/10 p-4 text-sm text-danger">
            <strong className="font-bold">Campaign failed:</strong> {campaign.failureReason}
          </div>
        )}

        {actionError && (
          <div className="mt-6 rounded-card border border-danger/25 bg-danger/10 p-4 text-sm text-danger">{actionError}</div>
        )}

        <MetricsGrid metrics={metrics} />

        <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-8">
            <SequenceSection
              campaignId={campaignId}
              employeeId={campaign.employeeId}
              steps={steps}
              editable={isDraft}
              onChanged={load}
              onPreview={setPreviewStepId}
            />

            <RecipientsSection
              campaignId={campaignId}
              recipients={filteredRecipients}
              allRecipients={recipients}
              editable={isDraft}
              filter={recipientFilter}
              onFilterChange={setRecipientFilter}
              onChanged={load}
            />
          </div>

          <div className="flex flex-col gap-6">
            <SummaryCard campaign={campaign} />

            {(isDraft || isScheduled) && (
              <LaunchPanel
                campaignId={campaignId}
                campaign={campaign}
                steps={steps}
                recipients={recipients}
                busy={actionBusy}
                onLaunched={load}
                setError={setActionError}
                setBusy={setActionBusy}
              />
            )}

            {(isRunning || isPaused) && (
              <div className="rounded-card border border-border-default bg-surface-card p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Sequence &amp; recipients</p>
                <p className="mt-2 text-sm text-text-tertiary">
                  Content and recipients are locked while a campaign is {campaign.status} — historical sent content is never
                  rewritten.
                </p>
              </div>
            )}

            {isReadOnlyHistory && (
              <div className="rounded-card border border-border-default bg-surface-card p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">History</p>
                <p className="mt-2 text-sm text-text-tertiary">
                  This campaign is {campaign.status} and read-only. Sequence, recipients, and send history remain available for
                  reporting.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {previewStepId && (
        <PreviewDialog
          campaignId={campaignId}
          stepId={previewStepId}
          recipients={recipients}
          onClose={() => setPreviewStepId(null)}
        />
      )}
    </main>
  );
}

function MetricsGrid({ metrics }: { metrics: CampaignMetrics }) {
  const items: Array<{ label: string; value: number; tone?: "danger" }> = [
    { label: "Enrolled", value: metrics.enrolled },
    { label: "Eligible", value: metrics.eligible },
    { label: "Scheduled", value: metrics.scheduled },
    { label: "Sent", value: metrics.sent },
    { label: "Replied", value: metrics.replied },
    { label: "Interested", value: metrics.interested },
    { label: "Handed off", value: metrics.handedOff },
    { label: "Completed", value: metrics.completed },
    { label: "Suppressed", value: metrics.suppressed },
    { label: "Opted out", value: metrics.optedOut },
    { label: "Failed", value: metrics.failed, tone: metrics.failed > 0 ? "danger" : undefined },
  ];

  const reply = ratePercent(metrics.replied, metrics.sent);
  const handoff = ratePercent(metrics.handedOff, metrics.replied);

  return (
    <section className="mt-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <div key={item.label} className="rounded-card border border-border-default bg-surface-card p-4 text-center">
            <p className={`text-2xl font-black ${item.tone === "danger" && item.value > 0 ? "text-danger" : "text-white"}`}>
              {item.value}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-text-muted">{item.label}</p>
          </div>
        ))}
      </div>
      {(reply || handoff) && (
        <p className="mt-3 text-xs text-text-muted">
          {reply && <>Reply rate {reply} of sent. </>}
          {handoff && <>Sales handoff rate {handoff} of replies.</>}
        </p>
      )}
    </section>
  );
}

function LifecycleActions({
  campaign,
  busy,
  onPause,
  onResume,
  onStop,
}: {
  campaign: Campaign;
  busy: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}) {
  if (campaign.status === "running") {
    return (
      <div className="flex shrink-0 gap-3">
        <Button variant="secondary" onClick={onPause} disabled={busy}>
          Pause
        </Button>
        <Button variant="danger" onClick={onStop} disabled={busy}>
          Stop
        </Button>
      </div>
    );
  }
  if (campaign.status === "paused") {
    return (
      <div className="flex shrink-0 gap-3">
        <Button variant="primary" onClick={onResume} disabled={busy}>
          Resume
        </Button>
        <Button variant="danger" onClick={onStop} disabled={busy}>
          Stop
        </Button>
      </div>
    );
  }
  if (campaign.status === "scheduled") {
    return (
      <div className="flex shrink-0 gap-3">
        <Button variant="danger" onClick={onStop} disabled={busy}>
          Stop
        </Button>
      </div>
    );
  }
  return null;
}

function SummaryCard({ campaign }: { campaign: Campaign }) {
  const rows: Array<[string, string]> = [
    ["Channel", "Email"],
    ["Outreach employee", campaign.employeeName ?? "—"],
    ["Sender", "Platform SuperKuba address"],
    ["Created", formatDate(campaign.createdAt)],
  ];
  if (campaign.launchedAt) rows.push(["Approved / launched", formatDateTime(campaign.launchedAt)]);
  if (campaign.scheduledAt) rows.push(["Scheduled for", formatDateTime(campaign.scheduledAt)]);
  if (campaign.startedAt) rows.push(["Started", formatDateTime(campaign.startedAt)]);
  if (campaign.pausedAt) rows.push(["Paused", formatDateTime(campaign.pausedAt)]);
  if (campaign.completedAt) rows.push(["Completed", formatDateTime(campaign.completedAt)]);
  if (campaign.stoppedAt) rows.push(["Stopped", formatDateTime(campaign.stoppedAt)]);

  return (
    <div className="rounded-card border border-border-default bg-surface-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Campaign summary</p>
      <dl className="mt-4 flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <dt className="text-text-tertiary">{label}</dt>
            <dd className="text-right font-semibold text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[11px] leading-5 text-text-muted">
        Every campaign email currently sends from one platform-wide address — per-business verified sending identities aren&apos;t
        available yet.
      </p>
      <Link
        href={`/dashboard/ai-employees/${campaign.employeeId}/test`}
        className="mt-4 inline-block text-xs font-semibold text-accent hover:underline"
      >
        Ask Kuba Outreach to summarize this audience or explain performance →
      </Link>
    </div>
  );
}

function SequenceSection({
  campaignId,
  employeeId,
  steps,
  editable,
  onChanged,
  onPreview,
}: {
  campaignId: string;
  employeeId: string;
  steps: SequenceStep[];
  editable: boolean;
  onChanged: () => Promise<void>;
  onPreview: (stepId: string) => void;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <section className="rounded-card border border-border-default bg-surface-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Sequence</p>
          <h2 className="mt-1 text-xl font-bold">Steps</h2>
        </div>
        {editable && (
          <div className="flex gap-2">
            <Button href={`/dashboard/ai-employees/${employeeId}/test`} size="sm" variant="ghost">
              Ask Kuba Outreach to draft
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
              + Add step
            </Button>
          </div>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="✉"
            title="No sequence steps yet."
            description="Add at least one step before this campaign can be launched. Ask Kuba Outreach to draft one grounded in your business knowledge and research, then review and edit it here."
            actionLabel={editable ? "+ Add step" : undefined}
            onAction={editable ? () => setAdding(true) : undefined}
            secondaryLabel={editable ? "Ask Kuba Outreach" : undefined}
            secondaryHref={editable ? `/dashboard/ai-employees/${employeeId}/test` : undefined}
            compact
          />
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {steps.map((step) => (
            <SequenceStepRow
              key={step.id}
              campaignId={campaignId}
              step={step}
              editable={editable}
              onChanged={onChanged}
              onPreview={() => onPreview(step.id)}
            />
          ))}
        </ul>
      )}

      {adding && (
        <SequenceStepForm
          campaignId={campaignId}
          nextStepNumber={steps.length + 1}
          onClose={() => setAdding(false)}
          onSaved={async () => {
            setAdding(false);
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

function SequenceStepRow({
  campaignId,
  step,
  editable,
  onChanged,
  onPreview,
}: {
  campaignId: string;
  step: SequenceStep;
  editable: boolean;
  onChanged: () => Promise<void>;
  onPreview: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function remove() {
    setRemoving(true);
    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}/sequence/${step.id}`, { method: "DELETE" });
      if (response.ok) await onChanged();
    } finally {
      setRemoving(false);
    }
  }

  if (editing) {
    return (
      <SequenceStepForm
        campaignId={campaignId}
        stepId={step.id}
        nextStepNumber={step.stepNumber}
        initial={step}
        onClose={() => setEditing(false)}
        onSaved={async () => {
          setEditing(false);
          await onChanged();
        }}
      />
    );
  }

  return (
    <li className="rounded-control border border-border-muted bg-surface-page/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent">
            {step.stepNumber}
          </span>
          <div>
            <p className="text-sm font-bold text-white">{step.subjectTemplate || "(no subject)"}</p>
            <p className="text-xs text-text-muted">
              {step.stepNumber === 1 ? "Sends at enrollment" : `Sends ${step.delayHours}h after the previous step`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={onPreview}>
            Preview
          </Button>
          {editable && (
            <>
              <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={remove} disabled={removing}>
                Remove
              </Button>
            </>
          )}
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text-tertiary">{step.bodyTemplate}</p>
    </li>
  );
}

const TEMPLATE_VARIABLES = ["{{displayName}}"];

function SequenceStepForm({
  campaignId,
  stepId,
  nextStepNumber,
  initial,
  onClose,
  onSaved,
}: {
  campaignId: string;
  stepId?: string;
  nextStepNumber: number;
  initial?: SequenceStep;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [delayHours, setDelayHours] = useState(initial?.delayHours ?? (nextStepNumber === 1 ? 0 : 24));
  const [subjectTemplate, setSubjectTemplate] = useState(initial?.subjectTemplate ?? "");
  const [bodyTemplate, setBodyTemplate] = useState(initial?.bodyTemplate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const url = stepId
        ? `/api/outreach/campaigns/${campaignId}/sequence/${stepId}`
        : `/api/outreach/campaigns/${campaignId}/sequence`;
      const response = await fetch(url, {
        method: stepId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delayHours, subjectTemplate, bodyTemplate }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to save sequence step.");
      await onSaved();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to save sequence step.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4 rounded-control border border-border-default bg-surface-page/60 p-4">
      {nextStepNumber > 1 && (
        <FormField label="Delay after previous step (hours)">
          <input
            type="number"
            min={0}
            value={delayHours}
            onChange={(event) => setDelayHours(Number(event.target.value))}
            className="w-full rounded-control border border-border-default bg-surface-page px-4 py-2.5 text-sm text-white outline-none focus:border-accent/50"
          />
        </FormField>
      )}
      <FormField label="Subject" description={`Available variables: ${TEMPLATE_VARIABLES.join(", ")}`}>
        <input
          type="text"
          value={subjectTemplate}
          onChange={(event) => setSubjectTemplate(event.target.value)}
          placeholder="Quick question, {{displayName}}"
          className="w-full rounded-control border border-border-default bg-surface-page px-4 py-2.5 text-sm text-white outline-none placeholder:text-text-muted focus:border-accent/50"
        />
      </FormField>
      <FormField label="Body" required description="Deterministic {{variable}} placeholders only — never a value written for one specific recipient.">
        <textarea
          value={bodyTemplate}
          onChange={(event) => setBodyTemplate(event.target.value)}
          required
          rows={5}
          placeholder="Hi {{displayName}}, ..."
          className="w-full rounded-control border border-border-default bg-surface-page px-4 py-2.5 text-sm text-white outline-none placeholder:text-text-muted focus:border-accent/50"
        />
      </FormField>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" disabled={saving || !bodyTemplate.trim()}>
          {saving ? "Saving..." : "Save step"}
        </Button>
      </div>
    </form>
  );
}

function RecipientsSection({
  campaignId,
  recipients,
  allRecipients,
  editable,
  filter,
  onFilterChange,
  onChanged,
}: {
  campaignId: string;
  recipients: Recipient[];
  allRecipients: Recipient[];
  editable: boolean;
  filter: (typeof RECIPIENT_FILTERS)[number];
  onFilterChange: (value: (typeof RECIPIENT_FILTERS)[number]) => void;
  onChanged: () => Promise<void>;
}) {
  const [enrolling, setEnrolling] = useState(false);

  return (
    <section className="rounded-card border border-border-default bg-surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Audience</p>
          <h2 className="mt-1 text-xl font-bold">Recipients ({allRecipients.length})</h2>
        </div>
        {editable && (
          <Button size="sm" variant="secondary" onClick={() => setEnrolling(true)}>
            + Add recipients
          </Button>
        )}
      </div>

      <p className="mt-2 text-xs text-text-muted">
        Automatic reply detection isn&apos;t active yet — it requires inbound email receiving to be configured for this
        workspace. Replies and Sales hand-offs from this campaign won&apos;t appear here until that&apos;s set up.
      </p>

      {allRecipients.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {RECIPIENT_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onFilterChange(option)}
              className={`rounded-pill border px-3 py-1.5 text-xs font-semibold transition ${
                filter === option
                  ? "border-accent/50 bg-accent/10 text-accent"
                  : "border-border-default bg-surface-page/40 text-text-tertiary hover:text-white"
              }`}
            >
              {option === "all" ? "All" : RECIPIENT_STATUS_LABEL[option] ?? option}
            </button>
          ))}
        </div>
      )}

      {allRecipients.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon="◎"
            title="No recipients yet."
            description="Research or add prospects before building a campaign — recipients are enrolled from your saved Outreach contacts."
            actionLabel={editable ? "+ Add recipients" : undefined}
            onAction={editable ? () => setEnrolling(true) : undefined}
            compact
          />
        </div>
      ) : (
        <RecipientTable campaignId={campaignId} recipients={recipients} editable={editable} onChanged={onChanged} />
      )}

      {enrolling && (
        <RecipientEnrollmentDialog
          campaignId={campaignId}
          onClose={() => setEnrolling(false)}
          onEnrolled={async () => {
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

function RecipientTable({
  campaignId,
  recipients,
  editable,
  onChanged,
}: {
  campaignId: string;
  recipients: Recipient[];
  editable: boolean;
  onChanged: () => Promise<void>;
}) {
  async function removeRecipient(recipientId: string) {
    const response = await fetch(`/api/outreach/campaigns/${campaignId}/recipients/${recipientId}`, { method: "DELETE" });
    if (response.ok) await onChanged();
  }

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-muted text-left">
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Contact</th>
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Company</th>
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Destination</th>
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Status</th>
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Step</th>
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Next send</th>
            <th className="px-3 py-3 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted">Last reply</th>
            {editable && <th className="px-3 py-3" />}
          </tr>
        </thead>
        <tbody>
          {recipients.map((recipient) => (
            <tr key={recipient.id} className="border-b border-border-muted/60">
              <td className="px-3 py-3 font-semibold text-white">{recipient.displayName || "—"}</td>
              <td className="px-3 py-3 text-text-tertiary">{recipient.companyName || "—"}</td>
              <td className="px-3 py-3 text-text-tertiary">{recipient.destinationIdentity}</td>
              <td className="px-3 py-3">
                <StatusBadge
                  status={RECIPIENT_STATUS_SEMANTIC[recipient.status] ?? "neutral"}
                  label={RECIPIENT_STATUS_LABEL[recipient.status] ?? recipient.status}
                />
                {recipient.suppressionReason && (
                  <p className="mt-1 text-[10px] text-text-muted">{recipient.suppressionReason.replace(/_/g, " ")}</p>
                )}
                {recipient.status === "handed_off" && (
                  <p className="mt-1 text-[10px] text-text-muted">
                    {formatDateTime(recipient.handedOffAt)}
                    {recipient.handoffReasonLabel ? ` · ${recipient.handoffReasonLabel}` : ""}
                    {recipient.handoffAssignedEmployeeName ? ` · to ${recipient.handoffAssignedEmployeeName}` : ""}
                    {recipient.handoffLeadId ? (
                      <>
                        {" · "}
                        <Link href="/dashboard/sales" className="text-accent hover:underline">
                          View in Sales
                        </Link>
                      </>
                    ) : null}
                  </p>
                )}
              </td>
              <td className="px-3 py-3 text-text-tertiary">{recipient.currentStepNumber ?? "—"}</td>
              <td className="px-3 py-3 text-text-tertiary">{formatDateTime(recipient.nextSendAt)}</td>
              <td className="px-3 py-3 text-text-tertiary">{formatDateTime(recipient.lastReplyAt)}</td>
              {editable && (
                <td className="px-3 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => removeRecipient(recipient.id)}>
                    Remove
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ELIGIBILITY_LABEL: Record<string, string> = {
  alreadyEnrolled: "Already enrolled",
  suppressed: "Suppressed",
  doNotContact: "Do not contact",
  consentWithdrawn: "Consent withdrawn",
  missingDestination: "Missing email",
  eligible: "Eligible",
};

function contactEligibility(contact: Contact): keyof typeof ELIGIBILITY_LABEL {
  if (contact.alreadyEnrolled) return "alreadyEnrolled";
  if (contact.suppressed) return "suppressed";
  if (contact.doNotContact) return "doNotContact";
  if (contact.consentStatus === "withdrawn") return "consentWithdrawn";
  if (!contact.email) return "missingDestination";
  return "eligible";
}

function RecipientEnrollmentDialog({
  campaignId,
  onClose,
  onEnrolled,
}: {
  campaignId: string;
  onClose: () => void;
  onEnrolled: () => Promise<void>;
}) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<Array<{ contactId: string; outcome: string }> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const query = new URLSearchParams({ campaignId });
          if (search.trim()) query.set("search", search.trim());
          const response = await fetch(`/api/outreach/contacts?${query.toString()}`, { cache: "no-store" });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to load contacts.");
          setContacts(data.contacts ?? []);
        } catch (loadError) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load contacts.");
        } finally {
          setLoading(false);
        }
      })();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [campaignId, search]);

  function toggle(contactId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}/recipients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: Array.from(selected) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to enroll recipients.");
      setResults(data.results ?? []);
      await onEnrolled();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to enroll recipients.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog title="Add recipients" description="Select saved Outreach contacts to enroll into this campaign." onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search name, email, or company..."
          className="w-full rounded-control border border-border-default bg-surface-page px-4 py-2.5 text-sm text-white outline-none placeholder:text-text-muted focus:border-accent/50"
        />

        {loading ? (
          <LoadingState message="Loading contacts..." />
        ) : contacts.length === 0 ? (
          <EmptyState
            icon="◎"
            title="No saved contacts found."
            description="Ask Kuba Outreach to research and save prospects/contacts first, or add one manually."
            compact
          />
        ) : (
          <div className="max-h-96 overflow-y-auto rounded-control border border-border-muted">
            <table className="w-full text-left text-sm">
              <tbody>
                {contacts.map((contact) => {
                  const eligibility = contactEligibility(contact);
                  const disabled = eligibility !== "eligible";
                  return (
                    <tr key={contact.contactId} className="border-b border-border-muted/60 last:border-0">
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={selected.has(contact.contactId)}
                          onChange={() => toggle(contact.contactId)}
                          className="h-4 w-4 rounded border-border-default accent-accent"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-white">{contact.name || contact.email || "Unnamed contact"}</p>
                        <p className="text-xs text-text-muted">
                          {contact.companyName}
                          {contact.icpFitScore !== null ? ` · ICP ${contact.icpFitScore}/100` : ""}
                          {contact.qualificationStatus ? ` · ${contact.qualificationStatus}` : ""}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className={`text-xs font-semibold ${eligibility === "eligible" ? "text-success" : "text-text-muted"}`}
                        >
                          {ELIGIBILITY_LABEL[eligibility]}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results && (
          <div className="rounded-control border border-border-muted bg-surface-page/40 p-3 text-xs text-text-tertiary">
            {results.filter((r) => r.outcome === "enrolled").length} enrolled ·{" "}
            {results.filter((r) => r.outcome !== "enrolled").length} not enrolled
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {results ? "Close" : "Cancel"}
          </Button>
          {!results && (
            <Button variant="primary" onClick={submit} disabled={submitting || selected.size === 0}>
              {submitting ? "Enrolling..." : `Enroll ${selected.size || ""}`.trim()}
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}

function LaunchPanel({
  campaignId,
  campaign,
  steps,
  recipients,
  busy,
  onLaunched,
  setError,
  setBusy,
}: {
  campaignId: string;
  campaign: Campaign;
  steps: SequenceStep[];
  recipients: Recipient[];
  busy: boolean;
  onLaunched: () => Promise<void>;
  setError: (value: string) => void;
  setBusy: (value: boolean) => void;
}) {
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");

  const eligibleCount = recipients.filter((r) => r.status === "ready" || r.status === "scheduled").length;
  const suppressedCount = recipients.filter((r) => r.status === "suppressed" || r.status === "opted_out").length;
  const canLaunch = campaign.status === "draft" && steps.length > 0 && eligibleCount > 0;

  async function launchNow() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}/launch`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to launch campaign.");
      await onLaunched();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to launch campaign.");
    } finally {
      setBusy(false);
    }
  }

  async function schedule() {
    if (!scheduledAt) {
      setError("Choose a date and time to schedule this campaign.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/outreach/campaigns/${campaignId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(scheduledAt).toISOString() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to schedule campaign.");
      await onLaunched();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to schedule campaign.");
    } finally {
      setBusy(false);
    }
  }

  if (campaign.status === "scheduled") {
    return (
      <div className="rounded-card border border-accent/30 bg-accent/[0.06] p-5">
        <p className="text-xs font-bold uppercase tracking-[0.15em] text-accent">Approved &amp; scheduled</p>
        <p className="mt-2 text-sm text-text-tertiary">
          Launches automatically at {formatDateTime(campaign.scheduledAt)}. Stop it above if plans change.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border-default bg-surface-card p-5">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-text-muted">Review &amp; launch</p>

      <dl className="mt-4 flex flex-col gap-2.5 text-sm">
        <Row label="Sequence steps" value={String(steps.length)} />
        <Row label="Recipients enrolled" value={String(recipients.length)} />
        <Row label="Eligible to send" value={String(eligibleCount)} />
        <Row label="Suppressed / ineligible" value={String(suppressedCount)} />
      </dl>

      {!canLaunch && (
        <p className="mt-4 text-xs text-warning">
          {steps.length === 0
            ? "Add at least one sequence step before launching."
            : eligibleCount === 0
              ? "Enroll at least one eligible recipient before launching."
              : "This campaign cannot be launched right now."}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        {!scheduleMode ? (
          <>
            <Button variant="primary" onClick={launchNow} disabled={!canLaunch || busy}>
              {busy ? "Launching..." : "Launch campaign"}
            </Button>
            <Button variant="secondary" onClick={() => setScheduleMode(true)} disabled={!canLaunch || busy}>
              Schedule for later
            </Button>
          </>
        ) : (
          <>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              className="w-full rounded-control border border-border-default bg-surface-page px-4 py-2.5 text-sm text-white outline-none focus:border-accent/50"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setScheduleMode(false)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="primary" onClick={schedule} disabled={busy}>
                {busy ? "Scheduling..." : "Schedule campaign"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-tertiary">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  );
}

function PreviewDialog({
  campaignId,
  stepId,
  recipients,
  onClose,
}: {
  campaignId: string;
  stepId: string;
  recipients: Recipient[];
  onClose: () => void;
}) {
  const [recipientId, setRecipientId] = useState<string>(recipients[0]?.id ?? "");
  const [preview, setPreview] = useState<{ from: string | null; to: string; subject: string; html: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadPreview = useCallback(
    async (targetRecipientId: string) => {
      setLoading(true);
      setError("");
      try {
        const query = targetRecipientId ? `?recipientId=${encodeURIComponent(targetRecipientId)}` : "";
        const response = await fetch(`/api/outreach/campaigns/${campaignId}/sequence/${stepId}/preview${query}`, {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to generate preview.");
        setPreview(data);
      } catch (previewError) {
        setError(previewError instanceof Error ? previewError.message : "Unable to generate preview.");
      } finally {
        setLoading(false);
      }
    },
    [campaignId, stepId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPreview(recipientId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [recipientId, loadPreview]);

  return (
    <Dialog title="Email preview" description="Deterministic, local preview — nothing is sent." onClose={onClose} size="lg">
      <div className="flex flex-col gap-4">
        {recipients.length > 0 && (
          <FormField label="Preview as recipient">
            <select
              value={recipientId}
              onChange={(event) => setRecipientId(event.target.value)}
              className="w-full rounded-control border border-border-default bg-surface-page px-4 py-2.5 text-sm text-white outline-none focus:border-accent/50"
            >
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.displayName || recipient.destinationIdentity}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {loading ? (
          <LoadingState message="Rendering preview..." />
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : preview ? (
          <div className="overflow-hidden rounded-control border border-border-muted">
            <div className="border-b border-border-muted bg-surface-page/60 p-4 text-xs text-text-tertiary">
              <p>
                <span className="text-text-muted">From:</span> {preview.from || "Not configured (EMAIL_FROM missing)"}
              </p>
              <p className="mt-1">
                <span className="text-text-muted">To:</span> {preview.to}
              </p>
              <p className="mt-1">
                <span className="text-text-muted">Subject:</span> {preview.subject || "(no subject)"}
              </p>
            </div>
            <div className="max-h-80 overflow-y-auto whitespace-pre-wrap p-4 text-sm leading-6 text-white/90">{preview.html}</div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
