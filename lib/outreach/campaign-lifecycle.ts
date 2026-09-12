import { and, eq, inArray, lte } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaigns, outreachCampaignRecipients, outreachCampaignSends } from "@/db/schema";
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

export async function launchCampaign(businessId: string, campaignId: string, launchedByUserId: string, mode: "now" | "scheduled" = "now") {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  const next: CampaignStatus = mode === "now" ? "running" : "scheduled";
  assertCampaignTransition(campaign.status as CampaignStatus, next);

  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({
      status: next,
      // Launch is the v1 approval event (section 15) — record who and when.
      launchedBy: launchedByUserId,
      launchedAt: now,
      startedAt: next === "running" ? now : campaign.startedAt,
      updatedAt: now,
    })
    .where(eq(outreachCampaigns.id, campaignId));
}

/**
 * Called when a scheduled campaign's scheduled_at time arrives (e.g. from
 * the cron sweep) to actually begin execution.
 */
export async function startScheduledCampaign(businessId: string, campaignId: string) {
  const campaign = await loadCampaignOrThrow(businessId, campaignId);
  assertCampaignTransition(campaign.status as CampaignStatus, "running");
  const now = new Date();
  await db
    .update(outreachCampaigns)
    .set({ status: "running", startedAt: now, updatedAt: now })
    .where(eq(outreachCampaigns.id, campaignId));
}

/**
 * Finds every "scheduled" campaign across all businesses whose scheduled_at
 * has arrived and starts each one. Called once per cron invocation before
 * the send-processing sweep, so a scheduled campaign's sends actually
 * become due on the tick after its scheduled time, not only when someone
 * happens to load its dashboard page.
 */
export async function startDueCampaigns(now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: outreachCampaigns.id, businessId: outreachCampaigns.businessId })
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.status, "scheduled"), lte(outreachCampaigns.scheduledAt, now)));

  let started = 0;
  for (const campaign of due) {
    try {
      await startScheduledCampaign(campaign.businessId, campaign.id);
      started += 1;
    } catch (error) {
      console.error("Failed to start scheduled campaign", campaign.id, error);
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
