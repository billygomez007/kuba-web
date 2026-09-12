import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachSuppressions } from "@/db/schema";

export type SuppressionChannel = "email" | "phone";

/**
 * Safe, provider-agnostic email normalization: lowercase + trim only. This
 * deliberately does not perform provider-specific mailbox reduction (e.g.
 * stripping dots/plus-tags the way Gmail treats them as equivalent) — doing
 * that generically risks merging two genuinely different addresses at a
 * different provider under the same suppression entry.
 */
export function normalizeEmailForSuppression(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Best-effort E.164-shaped normalization without a phone-parsing library:
 * strips formatting (spaces, dashes, parens) and keeps only a leading "+"
 * and digits. This is not full E.164 validation (no country-code library is
 * a repo dependency yet — the rest of the codebase also stores WhatsApp
 * numbers as raw strings), but it's enough for stable, safe suppression-list
 * matching across minor formatting differences.
 */
export function normalizePhoneForSuppression(phone: string): string {
  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[^0-9]/g, "");
  return hasPlus ? `+${digits}` : digits;
}

export function normalizeForSuppression(channel: SuppressionChannel, identity: string): string {
  return channel === "email"
    ? normalizeEmailForSuppression(identity)
    : normalizePhoneForSuppression(identity);
}

/**
 * Checked before enrollment, immediately before every send, and before
 * scheduling each subsequent sequence step — never assume a check performed
 * earlier still holds, since a recipient can opt out or bounce between
 * steps of the same campaign.
 */
export async function isSuppressed(
  businessId: string,
  channel: SuppressionChannel,
  identity: string,
): Promise<boolean> {
  const normalized = normalizeForSuppression(channel, identity);
  const existing = await db
    .select({ id: outreachSuppressions.id })
    .from(outreachSuppressions)
    .where(
      and(
        eq(outreachSuppressions.businessId, businessId),
        eq(outreachSuppressions.channel, channel),
        eq(outreachSuppressions.normalizedIdentity, normalized),
      ),
    )
    .limit(1);
  return existing.length > 0;
}

export type SuppressionReason = "unsubscribed" | "bounced" | "complained" | "manual" | "invalid";

/**
 * Idempotent by design (unique on business/channel/identity) — a repeated
 * unsubscribe click or duplicate bounce webhook must never error.
 */
export async function addSuppression(params: {
  businessId: string;
  channel: SuppressionChannel;
  identity: string;
  reason: SuppressionReason;
  sourceCampaignId?: string | null;
}): Promise<void> {
  const normalized = normalizeForSuppression(params.channel, params.identity);
  const alreadySuppressed = await isSuppressed(params.businessId, params.channel, params.identity);
  if (alreadySuppressed) return;

  await db.insert(outreachSuppressions).values({
    id: crypto.randomUUID(),
    businessId: params.businessId,
    channel: params.channel,
    normalizedIdentity: normalized,
    reason: params.reason,
    sourceCampaignId: params.sourceCampaignId ?? null,
    createdAt: new Date(),
  });
}
