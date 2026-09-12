import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachContacts } from "@/db/schema";
import { assertCampaignFieldEditable } from "@/lib/outreach/campaign-mutability";
import { getCampaignOrThrow } from "@/lib/outreach/campaign-service";
import type { CampaignStatus } from "@/lib/outreach/campaign-state";
import { isSuppressed } from "@/lib/outreach/suppression";

/**
 * Deterministic recipient enrollment (approved spec, section 4).
 * Recipients can only be added while the campaign is a draft — adding
 * recipients after scheduling/launch would silently change execution
 * behavior after approval (see campaign-mutability.ts).
 */

export type EnrollmentOutcome =
  | "enrolled"
  | "already_enrolled"
  | "suppressed"
  | "ineligible"
  | "invalid_destination"
  | "wrong_tenant"
  | "error";

export interface EnrollmentResult {
  contactId: string;
  outcome: EnrollmentOutcome;
  recipientId?: string;
  reason?: string;
}

function destinationForChannel(
  channel: string,
  contact: { email: string | null; phone: string | null },
): string | null {
  if (channel === "email") return contact.email;
  if (channel === "phone" || channel === "whatsapp") return contact.phone;
  return null;
}

/**
 * Enrolls a batch of contacts into a campaign. One bad contact never fails
 * the whole batch — each contact gets its own outcome, and only a genuine
 * database error for one contact is caught per-item rather than aborting
 * the remaining contacts (no transactional all-or-nothing requirement
 * exists across different contacts, unlike within a single contact's own
 * enrollment write).
 */
export async function enrollRecipients(
  businessId: string,
  campaignId: string,
  contactIds: string[],
): Promise<EnrollmentResult[]> {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  assertCampaignFieldEditable(campaign.status as CampaignStatus, "recipients");

  const results: EnrollmentResult[] = [];

  for (const contactId of contactIds) {
    try {
      results.push(await enrollOneRecipient(businessId, campaignId, campaign.channel, contactId));
    } catch (error) {
      results.push({
        contactId,
        outcome: "error",
        reason: error instanceof Error ? error.message : "Unknown enrollment error.",
      });
    }
  }

  return results;
}

async function enrollOneRecipient(
  businessId: string,
  campaignId: string,
  channel: string,
  contactId: string,
): Promise<EnrollmentResult> {
  const contactRows = await db.select().from(outreachContacts).where(eq(outreachContacts.id, contactId)).limit(1);
  const contact = contactRows[0];

  if (!contact || contact.businessId !== businessId) {
    return { contactId, outcome: "wrong_tenant" };
  }

  const destinationIdentity = destinationForChannel(channel, contact);
  if (!destinationIdentity) {
    return { contactId, outcome: "invalid_destination", reason: `Contact has no usable ${channel} destination.` };
  }

  const existing = await db
    .select({ id: outreachCampaignRecipients.id })
    .from(outreachCampaignRecipients)
    .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.contactId, contactId)))
    .limit(1);
  if (existing[0]) {
    return { contactId, outcome: "already_enrolled", recipientId: existing[0].id };
  }

  const suppressed = await isSuppressed(businessId, channel === "email" ? "email" : "phone", destinationIdentity);
  const consentIneligible = contact.doNotContact || contact.consentStatus === "withdrawn";

  const now = new Date();
  const recipientId = crypto.randomUUID();
  const eligible = !suppressed && !consentIneligible;

  try {
    await db.insert(outreachCampaignRecipients).values({
      id: recipientId,
      businessId,
      campaignId,
      contactId,
      prospectId: contact.prospectId ?? null,
      destinationChannel: channel,
      destinationIdentity,
      displayName: contact.name ?? null,
      status: eligible ? "ready" : "suppressed",
      currentStepNumber: eligible ? 1 : null,
      enrolledAt: now,
      suppressedAt: eligible ? null : now,
      suppressionReason: eligible ? null : suppressed ? "suppressed_at_enrollment" : "consent_not_available",
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    // A unique (campaign_id, contact_id) violation means a concurrent
    // enrollment call already created this recipient.
    const raced = await db
      .select({ id: outreachCampaignRecipients.id })
      .from(outreachCampaignRecipients)
      .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.contactId, contactId)))
      .limit(1);
    return { contactId, outcome: "already_enrolled", recipientId: raced[0]?.id };
  }

  if (!eligible) {
    return { contactId, recipientId, outcome: suppressed ? "suppressed" : "ineligible" };
  }
  return { contactId, recipientId, outcome: "enrolled" };
}

/** Only safe before launch — a campaign that has already started may have send history for this recipient. */
export async function removeRecipientBeforeLaunch(businessId: string, campaignId: string, recipientId: string) {
  const campaign = await getCampaignOrThrow(businessId, campaignId);
  if (campaign.status !== "draft") {
    throw new Error(`Cannot remove a recipient while the campaign is "${campaign.status}" — only before launch.`);
  }

  await db
    .delete(outreachCampaignRecipients)
    .where(and(eq(outreachCampaignRecipients.id, recipientId), eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.businessId, businessId)));
}
