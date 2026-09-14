import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  outreachCampaigns,
  outreachCampaignRecipients,
  outreachCampaignSends,
  outreachContacts,
  outreachSequenceSteps,
} from "@/db/schema";
import { evaluateCampaignCompletion } from "@/lib/outreach/campaign-lifecycle";
import { buildCampaignReplyTo, renderTemplate, sendCampaignEmail, withUnsubscribeFooter } from "@/lib/outreach/email-channel";
import { assertRecipientTransition, type RecipientStatus } from "@/lib/outreach/recipient-state";
import {
  type FailureCode,
  recordSendFailure,
  recordSendSuccess,
} from "@/lib/outreach/send-worker";
import { isSuppressed } from "@/lib/outreach/suppression";

/**
 * The worker order of operations (approved spec, section 33), for one
 * already-claimed send:
 *   1. claim job atomically           <- done by the caller (send-worker.ts)
 *   2. load tenant-scoped context     <- loadSendContext
 *   3. confirm campaign still running <- gate A
 *   4. confirm recipient state allows sending <- gate B
 *   5. confirm suppression            <- gate C (first of the double gate)
 *   6. confirm consent/channel eligibility <- gate D (first of its double gate)
 *   7. confirm entitlement/policy      <- caller's responsibility (the route
 *      that created the campaign already gated launch via
 *      lib/outreach/campaign-policy.ts; a downgrade mid-campaign is a
 *      product decision not yet specified, so this pass does not re-check
 *      plan entitlement per send — flagged for follow-up)
 *   8. render/personalize deterministic final content
 *   9. persist final content/audit metadata BEFORE dispatch
 *   10. invoke provider with a deterministic idempotency key
 *   11. record provider success/failure
 *   12. update recipient state
 *   13. schedule next sequence step if applicable
 *   14. record usage exactly once     <- derived at read time from these
 *       rows (lib/billing/usage.ts), not written here — see that file's
 *       comment on why counting these rows is itself idempotent
 *   15. evaluate campaign completion
 *
 * Suppression and campaign-running are each checked TWICE: once here
 * (claim-time-adjacent) and once again immediately before the provider call
 * (section 17's "immediate pre-provider-send check", section 29's
 * suppression double gate) — a recipient can unsubscribe, or a campaign can
 * be paused/stopped, in the moments between claim and dispatch.
 */

export type ProcessSendOutcome =
  | "sent"
  | "cancelled_campaign_not_running"
  | "cancelled_recipient_not_eligible"
  | "cancelled_suppressed"
  | "cancelled_consent"
  | "retry_scheduled"
  | "dead_letter"
  | "failed";

export interface ProcessSendResult {
  sendId: string;
  outcome: ProcessSendOutcome;
}

const UNSUBSCRIBE_BASE_URL = () =>
  `${process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || "https://superkuba.com"}/api/outreach/unsubscribe`;

async function loadSendContext(sendId: string) {
  const rows = await db
    .select({
      send: outreachCampaignSends,
      recipient: outreachCampaignRecipients,
      campaign: outreachCampaigns,
      step: outreachSequenceSteps,
    })
    .from(outreachCampaignSends)
    .innerJoin(outreachCampaignRecipients, eq(outreachCampaignRecipients.id, outreachCampaignSends.recipientId))
    .innerJoin(outreachCampaigns, eq(outreachCampaigns.id, outreachCampaignSends.campaignId))
    .innerJoin(outreachSequenceSteps, eq(outreachSequenceSteps.id, outreachCampaignSends.sequenceStepId))
    .where(eq(outreachCampaignSends.id, sendId))
    .limit(1);
  return rows[0] ?? null;
}

async function cancelSend(sendId: string) {
  const now = new Date();
  await db
    .update(outreachCampaignSends)
    .set({ status: "cancelled", completedAt: now, updatedAt: now })
    .where(eq(outreachCampaignSends.id, sendId));
}

/**
 * Pause is recoverable, not terminal (section 17): "existing pending/
 * scheduled jobs should remain recoverable rather than deleted" and
 * "resume continues safely from the correct point". So a send claimed
 * while paused is released back to "scheduled" (not cancelled) and the
 * recipient is left untouched — the exact same job becomes claimable again
 * on the next tick, whether the campaign is resumed by then or still
 * paused (in which case this gate simply fires again, harmlessly).
 */
async function releaseSendForPause(sendId: string) {
  await db
    .update(outreachCampaignSends)
    .set({ status: "scheduled", claimedAt: null, claimedBy: null, leaseExpiresAt: null, updatedAt: new Date() })
    .where(eq(outreachCampaignSends.id, sendId));
}

/**
 * Stop (and any other non-running, non-paused campaign status) is
 * terminal (section 18): "pending/scheduled jobs belonging to the campaign
 * become stopped/cancelled" and "claimed-but-not-yet-dispatched work must
 * abort where safely possible".
 */
async function cancelSendForStoppedCampaign(sendId: string, recipientId: string, recipientStatus: RecipientStatus) {
  await cancelSend(sendId);
  if (recipientStatus !== "stopped") {
    await transitionRecipient(recipientId, recipientStatus, "stopped");
  }
}

async function transitionRecipient(recipientId: string, current: RecipientStatus, next: RecipientStatus, extra: Record<string, unknown> = {}) {
  assertRecipientTransition(current, next);
  await db
    .update(outreachCampaignRecipients)
    .set({ status: next, updatedAt: new Date(), ...extra })
    .where(eq(outreachCampaignRecipients.id, recipientId));
}

async function markRecipientSuppressed(recipientId: string, current: RecipientStatus, reason: string) {
  const now = new Date();
  await transitionRecipient(recipientId, current, "suppressed", { suppressedAt: now, suppressionReason: reason });
}

/**
 * Advances the recipient and creates exactly one send row for the next
 * sequence step, or completes the recipient if that was the last step
 * (section 34). The unique index on (recipient_id, sequence_step_id)
 * guarantees this can never create a duplicate job even if called twice.
 */
async function advanceRecipientAfterSend(recipient: typeof outreachCampaignRecipients.$inferSelect, campaignId: string) {
  const now = new Date();
  const nextStepRows = await db
    .select()
    .from(outreachSequenceSteps)
    .where(and(eq(outreachSequenceSteps.campaignId, campaignId), eq(outreachSequenceSteps.stepNumber, (recipient.currentStepNumber ?? 1) + 1)))
    .limit(1);
  const nextStep = nextStepRows[0];

  if (!nextStep) {
    await transitionRecipient(recipient.id, "sent", "completed", { completedAt: now });
    return;
  }

  // "sent" -> "ready" (eligible for the next step) before a job for that
  // step exists, matching the recipient state machine.
  await transitionRecipient(recipient.id, "sent", "ready");

  const nextSendAt = new Date(now.getTime() + nextStep.delayHours * 60 * 60_000);

  try {
    await db.insert(outreachCampaignSends).values({
      id: crypto.randomUUID(),
      businessId: recipient.businessId,
      campaignId,
      recipientId: recipient.id,
      sequenceStepId: nextStep.id,
      status: "scheduled",
      scheduledAt: nextSendAt,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    // Unique (recipient_id, sequence_step_id) violation: the next step's
    // send row already exists (e.g. this ran twice) — never insert a
    // duplicate job.
  }

  // "ready" -> "scheduled" now that a send job exists for the next step.
  await transitionRecipient(recipient.id, "ready", "scheduled", { currentStepNumber: nextStep.stepNumber, nextSendAt });
}

/**
 * Processes exactly one already-claimed send. Must be called only after
 * lib/outreach/send-worker.ts's claimDueSends has atomically won the claim
 * for this send id.
 */
export async function processClaimedSend(sendId: string): Promise<ProcessSendResult> {
  const context = await loadSendContext(sendId);
  if (!context) throw new Error(`Claimed send ${sendId} has no loadable context.`);
  const { recipient, campaign, step } = context;

  // Gate A: campaign must still be running.
  if (campaign.status === "paused") {
    await releaseSendForPause(sendId);
    return { sendId, outcome: "cancelled_campaign_not_running" };
  }
  if (campaign.status !== "running") {
    await cancelSendForStoppedCampaign(sendId, recipient.id, recipient.status as RecipientStatus);
    return { sendId, outcome: "cancelled_campaign_not_running" };
  }

  // Gate B: recipient must be in a state that allows sending.
  if (recipient.status !== "scheduled") {
    await cancelSend(sendId);
    return { sendId, outcome: "cancelled_recipient_not_eligible" };
  }

  await transitionRecipient(recipient.id, "scheduled", "in_progress");

  // Gate C (1st of 2): suppression, checked before doing any rendering work.
  if (await isSuppressed(recipient.businessId, "email", recipient.destinationIdentity)) {
    await cancelSend(sendId);
    await markRecipientSuppressed(recipient.id, "in_progress", "suppressed_before_send");
    return { sendId, outcome: "cancelled_suppressed" };
  }

  // Gate D (1st of 2): consent/channel eligibility.
  const contactRows = await db
    .select({ consentStatus: outreachContacts.consentStatus, doNotContact: outreachContacts.doNotContact })
    .from(outreachContacts)
    .where(eq(outreachContacts.id, recipient.contactId))
    .limit(1);
  const contact = contactRows[0];
  if (!contact || contact.doNotContact || contact.consentStatus === "withdrawn") {
    await cancelSend(sendId);
    await markRecipientSuppressed(recipient.id, "in_progress", "consent_not_available");
    return { sendId, outcome: "cancelled_consent" };
  }

  // Render deterministic final content. No AI call happens here — content
  // is either the static sequence-step template, or was already
  // AI-personalized upstream at enrollment/render time (section 39); this
  // orchestration never lets an LLM decide whether or when to send.
  const variables = { displayName: recipient.displayName || "there" };
  const subject = step.subjectTemplate ? renderTemplate(step.subjectTemplate, variables) : undefined;
  const bodyHtml = renderTemplate(step.bodyTemplate, variables);
  const htmlWithFooter = withUnsubscribeFooter({
    html: bodyHtml,
    businessId: recipient.businessId,
    recipientId: recipient.id,
    channel: "email",
    identity: recipient.destinationIdentity,
    unsubscribeBaseUrl: UNSUBSCRIBE_BASE_URL(),
  });

  // Persist rendered content BEFORE dispatch — a crash between this write
  // and the provider call still leaves an accurate record of what was
  // about to be sent (section 26).
  await db
    .update(outreachCampaignSends)
    .set({
      renderedSubject: subject ?? null,
      renderedBody: htmlWithFooter,
      personalizationMetadata: JSON.stringify({
        sequenceStepId: step.id,
        personalizationContextVersion: recipient.personalizationContextVersion ?? null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(outreachCampaignSends.id, sendId));

  // Gate A (2nd) + Gate C (2nd): immediate pre-provider-send re-check.
  // A campaign paused/stopped, or a recipient who unsubscribed, in the
  // moments since the checks above must still stop this exact send.
  const freshCampaign = await db
    .select({ status: outreachCampaigns.status })
    .from(outreachCampaigns)
    .where(eq(outreachCampaigns.id, campaign.id))
    .limit(1);
  if (freshCampaign[0]?.status === "paused") {
    await releaseSendForPause(sendId);
    await transitionRecipient(recipient.id, "in_progress", "scheduled");
    return { sendId, outcome: "cancelled_campaign_not_running" };
  }
  if (freshCampaign[0]?.status !== "running") {
    await cancelSendForStoppedCampaign(sendId, recipient.id, "in_progress");
    return { sendId, outcome: "cancelled_campaign_not_running" };
  }
  if (await isSuppressed(recipient.businessId, "email", recipient.destinationIdentity)) {
    await cancelSend(sendId);
    await markRecipientSuppressed(recipient.id, "in_progress", "suppressed_before_send");
    return { sendId, outcome: "cancelled_suppressed" };
  }

  const sendResult = await sendCampaignEmail({
    sendId,
    to: recipient.destinationIdentity,
    subject: subject || "",
    html: htmlWithFooter,
    replyTo: buildCampaignReplyTo({
      businessId: recipient.businessId,
      campaignId: campaign.id,
      recipientId: recipient.id,
      sendId,
    }),
  });

  if (sendResult.success) {
    await recordSendSuccess(sendId, {
      externalMessageId: sendResult.externalMessageId,
      renderedSubject: subject,
      renderedBody: htmlWithFooter,
    });
    await transitionRecipient(recipient.id, "in_progress", "sent", { lastSentAt: new Date() });
    await advanceRecipientAfterSend({ ...recipient, status: "sent" }, campaign.id);
    await evaluateCampaignCompletion(recipient.businessId, campaign.id);
    return { sendId, outcome: "sent" };
  }

  const failureCode: FailureCode = (sendResult.failureCode as FailureCode) || "provider_rejected_permanent";
  const failureOutcome = await recordSendFailure(sendId, failureCode, sendResult.failureReason || "Unknown failure");

  if (failureOutcome === "retry_scheduled") {
    // Recipient goes back to "scheduled" so the retried send is picked up
    // the same way any other due send is.
    await transitionRecipient(recipient.id, "in_progress", "scheduled");
  } else {
    await transitionRecipient(recipient.id, "in_progress", "failed");
    await evaluateCampaignCompletion(recipient.businessId, campaign.id);
  }

  return { sendId, outcome: failureOutcome === "retry_scheduled" ? "retry_scheduled" : failureOutcome };
}
