import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { integrations } from "@/db/schema";
import { normalizePhoneNumber } from "@/lib/voice/phone";

export interface VoicePhoneNumberRecord {
  integrationId: string;
  businessId: string;
  employeeId: string | null;
}

function readAssignedEmployeeId(metadata: string | null): string | null {
  try {
    const parsed = JSON.parse(metadata || "{}");
    return typeof parsed.employeeId === "string" && parsed.employeeId ? parsed.employeeId : null;
  } catch {
    return null;
  }
}

function isVoicePhoneRow(metadata: string | null): boolean {
  try {
    return JSON.parse(metadata || "{}").kind === "voice_phone";
  } catch {
    return false;
  }
}

/**
 * Tenant identification for inbound voice calls — the voice equivalent
 * of lib/channels/whatsapp.ts's resolveWhatsAppIntegrationByPhoneNumberId.
 * Resolves businessId + assigned employeeId EXCLUSIVELY from the
 * registered destination number's own integrations row, keyed by
 * provider + the number actually dialed. Never trusts a businessId or
 * employeeId supplied by the caller, a webhook payload field, or any
 * other client/provider-controlled input — those are exactly what an
 * inbound call's From/To numbers are, so tenant must come from OUR OWN
 * stored mapping, not theirs.
 *
 * Returns null for any number with no active voice-phone registration —
 * callers must degrade honestly (no business, no data touched) rather
 * than guess.
 */
export async function resolveVoiceIntegrationByPhoneNumber(
  provider: string,
  phoneNumber: string,
): Promise<VoicePhoneNumberRecord | null> {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return null;

  const rows = await db
    .select({ id: integrations.id, businessId: integrations.businessId, metadata: integrations.metadata })
    .from(integrations)
    .where(
      and(
        eq(integrations.provider, provider),
        eq(integrations.externalPhoneNumberId, normalized),
        eq(integrations.status, "active"),
      ),
    );

  const match = rows.find((row) => isVoicePhoneRow(row.metadata));
  if (!match) return null;

  return {
    integrationId: match.id,
    businessId: match.businessId,
    employeeId: readAssignedEmployeeId(match.metadata),
  };
}

/**
 * Cross-tenant uniqueness check for Phase 7's "a number cannot belong to
 * two businesses simultaneously" — checked at assignment time, across
 * ALL businesses (never scoped to the caller's own business, since the
 * whole point is to catch a number already claimed by someone else).
 */
export async function isPhoneNumberAlreadyRegistered(
  provider: string,
  phoneNumber: string,
  excludingBusinessId?: string,
): Promise<boolean> {
  const normalized = normalizePhoneNumber(phoneNumber);
  if (!normalized) return false;

  const rows = await db
    .select({ businessId: integrations.businessId, metadata: integrations.metadata })
    .from(integrations)
    .where(and(eq(integrations.provider, provider), eq(integrations.externalPhoneNumberId, normalized)));

  return rows.some((row) => isVoicePhoneRow(row.metadata) && row.businessId !== excludingBusinessId);
}
