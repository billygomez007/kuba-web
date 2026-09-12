import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachCampaignSends, outreachCampaigns } from "@/db/schema";
import { assertRecipientTransition, type RecipientStatus } from "@/lib/outreach/recipient-state";
import { promoteProspectToSales, type HandoffResult } from "@/lib/outreach/sales-handoff";

/**
 * Reply handling for the Campaign Engine (approved spec, sections 21-22,
 * 35-36). NOT YET WIRED to any live trigger — correlating an inbound
 * reply back to a specific recipient needs an inbound-email-receiving
 * mechanism (Resend supports this, but configuring a receiving domain is
 * a real DNS/production decision outside what this pass can make — see
 * CURRENT_STATE.md). These functions are the deterministic destination
 * that work will call into once that's decided.
 *
 * Two distinct, sequential steps (section 35 vs 36) — not one combined
 * step:
 *  1. markRecipientReplied — called as soon as ANY reply arrives,
 *     regardless of whether it turns out to be Sales-worthy. Halts the
 *     normal sequence immediately (cancels pending scheduled sends) so
 *     Outreach never talks past a customer who just responded.
 *  2. handleCampaignReplyHandoff — called once a reply is evaluated as
 *     Sales-worthy, converging into the exact same deterministic Sales
 *     handoff core (lib/outreach/sales-handoff.ts) autonomous research
 *     promotion uses — never a parallel lead-creation path.
 */

async function cancelPendingSendsForRecipient(recipientId: string, now: Date) {
  // Only "scheduled" rows — a "claimed" row currently held by a worker is
  // left for that worker's own pre-dispatch check to self-abort, same
  // reasoning as campaign stop (lib/outreach/campaign-lifecycle.ts).
  await db
    .update(outreachCampaignSends)
    .set({ status: "cancelled", completedAt: now, updatedAt: now })
    .where(and(eq(outreachCampaignSends.recipientId, recipientId), eq(outreachCampaignSends.status, "scheduled")));
}

/**
 * Marks a recipient as having replied and halts their normal automated
 * sequence (section 35). Idempotent — calling this again while already
 * "replied" or further along (interested/handed_off) is a safe no-op, so
 * a duplicate inbound webhook delivery can never double-process a reply.
 */
export async function markRecipientReplied(businessId: string, campaignId: string, recipientId: string): Promise<void> {
  const rows = await db
    .select({ status: outreachCampaignRecipients.status })
    .from(outreachCampaignRecipients)
    .where(
      and(
        eq(outreachCampaignRecipients.id, recipientId),
        eq(outreachCampaignRecipients.campaignId, campaignId),
        eq(outreachCampaignRecipients.businessId, businessId),
      ),
    )
    .limit(1);
  const recipient = rows[0];
  if (!recipient) throw new Error("Campaign recipient not found for this business/campaign.");

  if (recipient.status === "replied" || recipient.status === "interested" || recipient.status === "handed_off") {
    return;
  }

  assertRecipientTransition(recipient.status as RecipientStatus, "replied");
  const now = new Date();
  await db
    .update(outreachCampaignRecipients)
    .set({ status: "replied", lastReplyAt: now, updatedAt: now })
    .where(eq(outreachCampaignRecipients.id, recipientId));

  await cancelPendingSendsForRecipient(recipientId, now);
}

/**
 * Promotes an already-"replied" recipient to Sales (section 36). Requires
 * markRecipientReplied to have already run — call it first.
 */
export async function handleCampaignReplyHandoff(params: {
  businessId: string;
  campaignId: string;
  recipientId: string;
  replySummary: string;
  recommendedNextAction: string;
}): Promise<HandoffResult> {
  const { businessId, campaignId, recipientId, replySummary, recommendedNextAction } = params;

  const recipientRows = await db
    .select()
    .from(outreachCampaignRecipients)
    .where(
      and(
        eq(outreachCampaignRecipients.id, recipientId),
        eq(outreachCampaignRecipients.campaignId, campaignId),
        eq(outreachCampaignRecipients.businessId, businessId),
      ),
    )
    .limit(1);
  const recipient = recipientRows[0];

  if (!recipient) {
    return { success: false, error: "Campaign recipient not found for this business/campaign." };
  }
  if (!recipient.prospectId) {
    // Every contact today is created through the Outreach research
    // pipeline, so this should not happen in practice — fail closed
    // rather than guessing at company identity.
    return { success: false, error: "This recipient has no linked Outreach prospect to promote." };
  }

  const alreadyHandedOff = recipient.status === "handed_off";
  if (!alreadyHandedOff) {
    assertRecipientTransition(recipient.status as RecipientStatus, "handed_off");
  }

  const employeeId = await resolveOwningEmployeeId(businessId, campaignId);
  const result = await promoteProspectToSales({
    businessId,
    prospectId: recipient.prospectId,
    employeeId,
    reason: { type: "campaign_reply_engagement", campaignId, recipientId, replySummary },
    recommendedNextAction,
  });

  if (!result.success) return result;

  if (!alreadyHandedOff) {
    const now = new Date();
    await db
      .update(outreachCampaignRecipients)
      .set({ status: "handed_off", handedOffAt: now, handoffLeadId: result.lead.id, updatedAt: now })
      .where(eq(outreachCampaignRecipients.id, recipientId));
    await cancelPendingSendsForRecipient(recipientId, now);
  }

  return result;
}

async function resolveOwningEmployeeId(businessId: string, campaignId: string): Promise<string> {
  const rows = await db
    .select({ employeeId: outreachCampaigns.employeeId })
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.businessId, businessId)))
    .limit(1);
  return rows[0]?.employeeId ?? "";
}
