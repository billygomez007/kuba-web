import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients, outreachCampaignSends } from "@/db/schema";

/**
 * Deterministic, persisted-data-only campaign metrics (section 14). Every
 * number here is a direct count of real rows — nothing is inferred,
 * estimated, or a placeholder for an event type that isn't implemented
 * (no open/click/conversion rate; those events don't exist yet).
 */
export interface CampaignMetrics {
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
}

export async function getCampaignMetrics(businessId: string, campaignId: string): Promise<CampaignMetrics> {
  const recipients = await db
    .select({ status: outreachCampaignRecipients.status })
    .from(outreachCampaignRecipients)
    .where(and(eq(outreachCampaignRecipients.campaignId, campaignId), eq(outreachCampaignRecipients.businessId, businessId)));

  const sends = await db
    .select({ status: outreachCampaignSends.status })
    .from(outreachCampaignSends)
    .where(and(eq(outreachCampaignSends.campaignId, campaignId), eq(outreachCampaignSends.businessId, businessId)));

  const countRecipients = (predicate: (status: string) => boolean) => recipients.filter((r) => predicate(r.status)).length;
  const countSends = (predicate: (status: string) => boolean) => sends.filter((s) => predicate(s.status)).length;

  return {
    enrolled: recipients.length,
    eligible: countRecipients((s) => ["ready", "scheduled", "in_progress"].includes(s)),
    scheduled: countRecipients((s) => s === "scheduled"),
    sent: countSends((s) => s === "sent"),
    failed: countSends((s) => s === "failed" || s === "dead_letter"),
    suppressed: countRecipients((s) => s === "suppressed"),
    optedOut: countRecipients((s) => s === "opted_out"),
    replied: countRecipients((s) => s === "replied" || s === "interested" || s === "handed_off"),
    interested: countRecipients((s) => s === "interested"),
    handedOff: countRecipients((s) => s === "handed_off"),
    completed: countRecipients((s) => s === "completed"),
  };
}

/**
 * Derived rates only where the denominator is meaningful and non-zero
 * (section 14). Returns null rather than a misleading 0% when there is
 * nothing to divide by yet.
 */
export function replyRate(metrics: CampaignMetrics): number | null {
  return metrics.sent > 0 ? metrics.replied / metrics.sent : null;
}

export function handoffRate(metrics: CampaignMetrics): number | null {
  return metrics.replied > 0 ? metrics.handedOff / metrics.replied : null;
}
