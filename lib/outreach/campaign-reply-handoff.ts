import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { messages, outreachCampaignRecipients, outreachCampaignSends, outreachCampaigns } from "@/db/schema";
import { conversationIdForCampaignRecipient } from "@/lib/email/inbound-correlation";
import { assertRecipientTransition, type RecipientStatus } from "@/lib/outreach/recipient-state";
import { promoteProspectToSales, type HandoffResult } from "@/lib/outreach/sales-handoff";

/**
 * Reply handling for the Campaign Engine (approved spec, sections 21-22,
 * 35-36). Two distinct, sequential steps (section 35 vs 36) — not one
 * combined step:
 *  1. markRecipientReplied — called automatically by the inbound email
 *     webhook (app/api/integrations/email/webhook/route.ts) as soon as
 *     ANY reply arrives, regardless of whether it turns out to be
 *     Sales-worthy. Halts the normal sequence immediately (cancels
 *     pending scheduled sends) so Outreach never talks past a customer
 *     who just responded.
 *  2. handleCampaignReplyHandoff — deliberately NOT auto-triggered from
 *     the webhook: a "not interested"/"unsubscribe" reply must never
 *     silently become a Sales lead. Called instead from a manual,
 *     human-triggered action (app/api/outreach/campaigns/[campaignId]/
 *     recipients/[recipientId]/handoff/route.ts, surfaced as "Hand off
 *     to Sales" in the Inbox), converging into the exact same
 *     deterministic Sales handoff core (lib/outreach/sales-handoff.ts)
 *     autonomous research promotion uses — never a parallel
 *     lead-creation path.
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

const MAX_REPLY_SUMMARY_LENGTH = 500;

/**
 * The reply text to use as handoff evidence, read from the actual
 * persisted inbound message for this recipient's conversation — never
 * accepted from a request body, so the stored handoff reason always
 * reflects what the customer actually sent, not client-supplied text.
 */
export async function getLatestReplySummary(businessId: string, recipientId: string): Promise<string> {
  const conversationId = conversationIdForCampaignRecipient(recipientId);
  const rows = await db
    .select({ content: messages.content })
    .from(messages)
    .where(and(eq(messages.businessId, businessId), eq(messages.conversationId, conversationId), eq(messages.direction, "inbound")))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return (rows[0]?.content || "No reply text on record.").slice(0, MAX_REPLY_SUMMARY_LENGTH);
}

async function resolveOwningEmployeeId(businessId: string, campaignId: string): Promise<string> {
  const rows = await db
    .select({ employeeId: outreachCampaigns.employeeId })
    .from(outreachCampaigns)
    .where(and(eq(outreachCampaigns.id, campaignId), eq(outreachCampaigns.businessId, businessId)))
    .limit(1);
  return rows[0]?.employeeId ?? "";
}
