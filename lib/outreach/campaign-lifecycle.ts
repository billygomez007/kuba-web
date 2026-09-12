import { and, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaigns, outreachCampaignRecipients, outreachCampaignSends, outreachSequenceSteps } from "@/db/schema";
import { assertCampaignTransition, type CampaignStatus } from "@/lib/outreach/campaign-state";

/**
 * Campaign lifecycle operations. Route handlers must call these, never
 * mutate outreach_campaigns.status directly (see section 40: routes stay
 * thin, domain logic lives here).
 *
 * Pause semantics (approved spec, section 17):
 *  - an already-claimed/in-flight send may complete if the provider has
 *    already accepted execution — enforced by the worker's own pre-dispatch
 *    check (lib/outreach/process-send.ts), not by anything here;
 *  - no NEW sends are claimed once paused — the claim query itself filters
 *    on campaign status (see send-worker.ts claim-time filtering);
 *  - future unsent sequence steps and existing scheduled/pending send rows
 *    are left untouched (recoverable, not deleted);
 *  - resume simply flips status back to "running" — nothing else needs to
 *    change for execution to continue from the correct point.
 *
 * Stop semantics (section 18):
 *  - terminal, idempotent (calling stop twice is a safe no-op);
 *  - only "scheduled" sends are cancelled here — a "claimed" row currently
 *    held by a worker is left for that worker's own pre-dispatch check to
 *    self-abort into "cancelled", since only the worker holding the claim
 *    should write to a row while it's actively processing it (avoids a
 *    write race between this function and an in-flight worker);
 *  - historical (sent/failed/etc.) send and recipient records are never
 *    modified or deleted.
 */

async function loadCampaignOrThrow(businessId: string, campaignId: string) {
  const rows = await db
    .select()
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.businessId, businessId)))
    .limit(1);
  const campaign = rows[0];
  if (!campaign) throw new Error("Campaign not found for this business.");
  return campaign;
}

/**
 * Creates exactly one first-step send job for every "ready" recipient and
 * moves each to "scheduled" (section 5). Protected by the unique
 * (recipient_id, sequence_step_id) index, so calling this twice for the
 * same campaign can never create duplicate jobs — a concurrent or repeated
 * call simply finds nothing left to do for a recipient whose job already
 * exists (checked to be idempotent below).
 *
 * Callers must have already transitioned the campaign to "running" before
 * calling this — it does not itself change campaign status.
 */
async function scheduleFirstSendsForCampaign(businessId: string, campaignId: string, now: Date) {
  const firstStepRows = await db
    .select()
    .from(outreachSequenceSteps)
    .where(and(eq(outreachSequenceSteps.campaignId, campaignId), eq(outreachSequenceSteps.stepNumber, 1)))
    .limit(1);
  const firstStep = firstStepRows[0];
  if (!firstStep) {
    throw new Error("Cannot launch a campaign with no sequence steps.");
  }

  const readyRecipients = await db
    .select()
    .from(outreachCampaignRecipients)
    .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.status, "ready")));
  if (readyRecipients.length === 0) {
    throw new Error("Cannot launch a campaign with zero eligible recipients.");
  }

  await db.transaction(async (tx) => {
    for (const recipient of readyRecipients) {
      try {
        await tx.insert(outreachCampaignSends).values({
          id: crypto.randomUUID(),
          businessId,
          campaignId,
          recipientId: recipient.id,
          sequenceStepId: firstStep.id,
          status: "scheduled",
          scheduledAt: now,
          attemptCount: 0,
          createdAt: now,
          updatedAt: now,
        });
      } catch {
        // Unique violation: this recipient's first-step job already exists
        // (a re-entrant/duplicate launch call) — never create a second one.
        continue;
      }

      await tx
        .update(outreachCampaignRecipients)
        .set({ status: "scheduled", currentStepNumber: 1, nextSendAt: now, updatedAt: now })
        .where(eq(outreachCampaignRecipients.id, recipient.id));
    }
  });
}

/**
 * User-initiated launch. Validates preconditions (a sequence step and at
 * least one eligible recipient must exist) BEFORE transitioning campaign
 * status, so a failed launch never leaves the campaign in a partially
 * executed "running" state with nothing actually scheduled (section 5).
 */
/** Launches a campaign immediately — validates before transitioning, so a bad launch fails safely (section 5). */
export async function launchCampaignNow(businessId: string, campaignId: string, launchedByUserId: string) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  assertCampaignTransition(campaign.status as CampaignStatus, "running");

  await scheduleFirstSendsForCampaignPreflight(campaignId);
  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "running", startedAt: now, launchedBy: launchedByUserId, launchedAt: now, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
  await scheduleFirstSendsForCampaign(businessId, campaignId, now);
}

/**
 * Approves a campaign to start at a future time. Does not itself schedule
 * any sends — startDueCampaigns/activateScheduledCampaign does that once
 * scheduledAt arrives. Still validates preconditions now (not just at
 * activation time) so an obviously-broken campaign is never accepted for
 * scheduling in the first place.
 */
export async function scheduleCampaign(businessId: string, campaignId: string, launchedByUserId: string, scheduledAt: Date) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  assertCampaignTransition(campaign.status as CampaignStatus, "scheduled");
  if (scheduledAt.getTime() <= Date.now()) {
    throw new Error("scheduledAt must be in the future.");
  }
  await scheduleFirstSendsForCampaignPreflight(campaignId);

  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "scheduled", scheduledAt, launchedBy: launchedByUserId, launchedAt: now, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
}

/** Throws before any state change if launch preconditions aren't met. */
async function scheduleFirstSendsForCampaignPreflight(campaignId: string) {
  const firstStepRows = await db
    .select({ id: outreachSequenceSteps.id })
    .from(outreachSequenceSteps)
    .where(and(eq(outreachSequenceSteps.campaignId, campaignId), eq(outreachSequenceSteps.stepNumber, 1)))
    .limit(1);
  if (!firstStepRows[0]) throw new Error("Cannot launch a campaign with no sequence steps.");

  const readyRecipients = await db
    .select({ id: outreachCampaignRecipients.id })
    .from(outreachCampaignRecipients)
    .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.status, "ready")))
    .limit(1);
  if (!readyRecipients[0]) throw new Error("Cannot launch a campaign with zero eligible recipients.");
}

/**
 * Called when a scheduled campaign's scheduled_at time arrives (e.g. from
 * the cron sweep) to actually begin execution.
 *
 * Concurrency-safe by construction: the status transition is an atomic
 * compare-and-swap UPDATE (status = "scheduled" -> "running", gated in the
 * WHERE clause), not a read-then-write — so two overlapping cron
 * invocations racing on the same campaign can never both activate it.
 * Returns false (a silent no-op) if this call lost the race or the
 * campaign was not actually due, rather than throwing a user-facing error
 * — this path has no human waiting on a response.
 */
export async function activateScheduledCampaign(businessId: string, campaignId: string, now: Date = new Date()): Promise<boolean> {
  const claim = await db
    .update(outreachCampaigns)
    .set({ status: "running", startedAt: now, updatedAt: now })
    .where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.businessId, businessId), eq(outreachCampaigns.status, "scheduled")));

  if ((claim.rowsAffected ?? 0) === 0) return false;

  try {
    await scheduleFirstSendsForCampaign(businessId, campaignId, now);
  } catch (error) {
    // Activation is now observably "running" with nothing schedulable —
    // fail it explicitly rather than leaving a silently stuck campaign
    // (section 6: "activation failure is observable").
    await db
      .update(outreachCampaigns)
      .set({
        status: "failed",
        failedAt: now,
        failureReason: error instanceof Error ? error.message : "Activation failed.",
        updatedAt: now,
      })
      .where(eq(outreachCampaigns.id, campaignId));
    return false;
  }

  return true;
}

/**
 * Finds every "scheduled" campaign across all businesses whose scheduled_at
 * has arrived and activates each one. Called once per cron invocation
 * before the send-processing sweep, so a scheduled campaign's sends
 * actually become due on the tick after its scheduled time, not only when
 * someone happens to load its dashboard page. Safe under concurrent
 * invocation — see activateScheduledCampaign's compare-and-swap.
 */
export async function startDueCampaigns(now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: outreachCampaigns.id, businessId: outreachCampaigns.businessId })
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.status, "scheduled"), lte(outreachCampaigns.scheduledAt, now)));

  let started = 0;
  for (const campaign of due) {
    try {
      const activated = await activateScheduledCampaign(campaign.businessId, campaign.id, now);
      if (activated) started += 1;
    } catch (error) {
      console.error("Failed to activate scheduled campaign", campaign.id, error);
    }
  }
  return started;
}

export async function pauseCampaign(businessId: string, campaignId: string) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  assertCampaignTransition(campaign.status as CampaignStatus, "paused");
  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "paused", pausedAt: now, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
}

export async function resumeCampaign(businessId: string, campaignId: string) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  assertCampaignTransition(campaign.status as CampaignStatus, "running");
  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "running", updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
}

/** Idempotent — calling stop on an already-stopped campaign is a no-op. */
export async function stopCampaign(businessId: string, campaignId: string) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  if (campaign.status === "stopped") return;

  assertCampaignTransition(campaign.status as CampaignStatus, "stopped");
  const now = new Date();

  await db
    .update(outreachCampaigns)
    .set({ status: "stopped", stoppedAt: now, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));

  // Only rows no worker currently holds a claim on. A "claimed" row is left
  // for its worker to self-abort via the pre-dispatch campaign-state check.
  await db
    .update(outreachCampaignSends)
    .set({ status: "cancelled", completedAt: now, updatedAt: now })
    .where(and(eq(outreachCampaignSends.campaignId, campaignId), eq(outreachCampaignSends.status, "scheduled")));
}

export async function failCampaign(businessId: string, campaignId: string, reason: string) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  assertCampaignTransition(campaign.status as CampaignStatus, "failed");
  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "failed", failedAt: now, failureReason: reason, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
}

// Recipient states that require no further automated work (section 20).
const RECIPIENT_END_STATES = [
  "completed",
  "replied",
  "interested",
  "handed_off",
  "suppressed",
  "opted_out",
  "failed",
  "stopped",
] as const;

// Send states that still represent outstanding work.
const SEND_OUTSTANDING_STATES = ["scheduled", "claimed"] as const;

/**
 * Centralized completion calculation (section 20). Call this after any
 * recipient reaches an end state, or after a send outcome is recorded —
 * never mark a campaign completed simply because a single cron batch found
 * zero immediately-due jobs; a future-scheduled step can still exist.
 */
export async function evaluateCampaignCompletion(businessId: string, campaignId: string): Promise<boolean> {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  if (campaign.status !== "running") return false;

  const outstandingRecipients = await db
    .select({ id: outreachCampaignRecipients.id })
    .from(outreachCampaignRecipients)
    .where(
      and(
        eq(outreachCampaignRecipients.campaignId, campaignId),
        // The complement of RECIPIENT_END_STATES — listed explicitly so a
        // future addition to RECIPIENT_STATUSES can't silently change
        // completion behavior without a deliberate update here too.
        inArray(outreachCampaignRecipients.status, [
          "pending",
          "ready",
          "scheduled",
          "in_progress",
          "sent",
        ]),
      ),
    )
    .limit(1);

  if (outstandingRecipients.length > 0) return false;

  const outstandingSends = await db
    .select({ id: outreachCampaignSends.id })
    .from(outreachCampaignSends)
    .where(
      and(
        eq(outreachCampaignSends.campaignId, campaignId),
        inArray(outreachCampaignSends.status, [...SEND_OUTSTANDING_STATES]),
      ),
    )
    .limit(1);

  if (outstandingSends.length > 0) return false;

  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "completed", completedAt: now, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
  return true;
}

export { RECIPIENT_END_STATES };
