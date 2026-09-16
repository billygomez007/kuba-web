import { and, eq, like } from "drizzle-orm";

import { db } from "@/db";
import { conversations, integrations, messages } from "@/db/schema";
import { extractReplyToken, verifyReplyToken, verifyOpaqueReplyToken } from "@/lib/email/reply-token";

/**
 * Business-safe addressing + reply correlation (Phases 5-6 of the email
 * audit). Tenant identification is NEVER derived from recipient display
 * name, subject text, sender email, or any client-supplied businessId —
 * only from a server-verified signed reply token (primary) or a
 * server-stored per-business inbound alias (fallback, for cold inbound
 * mail with no prior SuperKuba-sent email to reply to).
 *
 * Checked in order, the first deterministic match wins:
 *  1. A verified reply token in any recipient address — cryptographically
 *     signed, carries businessId/conversationId (+ campaign context)
 *     directly. This is the only path that can produce MATCHED_CAMPAIGN.
 *  2. A recipient address matching a business's own stored inbound alias
 *     (integrations.externalAccountId for provider "email") — resolves
 *     businessId deterministically from OUR OWN stored config, then looks
 *     for an existing conversation with this sender to decide
 *     MATCHED_CONTACT vs. NEW_CONVERSATION.
 *  3. Neither: UNMATCHED_REVIEW_REQUIRED. No businessId is ever guessed —
 *     nothing is persisted under any tenant for this case.
 */
export type InboundCorrelation =
  | {
      classification: "MATCHED_CAMPAIGN";
      businessId: string;
      conversationId: string;
      campaignId: string;
      recipientId: string;
      sendId?: string;
      conversationExists: boolean;
    }
  | {
      classification: "MATCHED_THREAD";
      businessId: string;
      conversationId: string;
      conversationExists: boolean;
    }
  | {
      classification: "MATCHED_CONTACT";
      businessId: string;
      integrationId: string;
      conversationId: string;
    }
  | {
      classification: "NEW_CONVERSATION";
      businessId: string;
      integrationId: string;
    }
  | { classification: "UNMATCHED_REVIEW_REQUIRED" };

export function normalizeEmailAddress(address: string): string {
  return address.trim().toLowerCase();
}

const CAMPAIGN_CONVERSATION_PREFIX = "email-campaign-";

/** Deterministic, stable conversation id for a campaign recipient — same value on every reply from the same recipient, requires no extra lookup table. */
export function conversationIdForCampaignRecipient(recipientId: string): string {
  return `${CAMPAIGN_CONVERSATION_PREFIX}${recipientId}`;
}

/** Inverse of conversationIdForCampaignRecipient — null for any conversation not created from a campaign reply. */
export function campaignRecipientIdFromConversationId(conversationId: string): string | null {
  return conversationId.startsWith(CAMPAIGN_CONVERSATION_PREFIX)
    ? conversationId.slice(CAMPAIGN_CONVERSATION_PREFIX.length)
    : null;
}

async function findReplyTokenMatch(toAddresses: string[]): Promise<InboundCorrelation | null> {
  for (const address of toAddresses) {
    const token = extractReplyToken(address);
    if (!token) continue;
    const payload = verifyReplyToken(token);
    if (!payload) {
      if (!/^R[A-Za-z0-9_-]{63}$/.test(token)) continue;
      const candidates = await db.select({ businessId: messages.businessId, conversationId: messages.conversationId, metadata: messages.metadata })
        .from(messages)
        .where(and(eq(messages.direction, "outbound"), like(messages.metadata, `%${token}%`)))
        .limit(1);
      const match = candidates.find((row) => row.metadata?.includes(token) && verifyOpaqueReplyToken(token, { businessId: row.businessId, conversationId: row.conversationId }));
      if (!match) continue;
      const existing = await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.id, match.conversationId), eq(conversations.businessId, match.businessId))).limit(1);
      return { classification: "MATCHED_THREAD", businessId: match.businessId, conversationId: match.conversationId, conversationExists: existing.length > 0 };
    }

    if (payload.campaignId && payload.recipientId) {
      const existing = await db
        .select({ id: conversations.id })
        .from(conversations)
        .where(eq(conversations.id, payload.conversationId))
        .limit(1);
      return {
        classification: "MATCHED_CAMPAIGN",
        businessId: payload.businessId,
        conversationId: payload.conversationId,
        campaignId: payload.campaignId,
        recipientId: payload.recipientId,
        sendId: payload.sendId,
        conversationExists: existing.length > 0,
      };
    }

    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, payload.conversationId))
      .limit(1);
    return {
      classification: "MATCHED_THREAD",
      businessId: payload.businessId,
      conversationId: payload.conversationId,
      conversationExists: existing.length > 0,
    };
  }
  return null;
}

async function findBusinessAliasMatch(toAddresses: string[], fromAddress: string): Promise<InboundCorrelation | null> {
  const normalizedTo = toAddresses.map(normalizeEmailAddress);
  const normalizedFrom = normalizeEmailAddress(fromAddress);

  for (const address of normalizedTo) {
    const integrationRows = await db
      .select({ id: integrations.id, businessId: integrations.businessId })
      .from(integrations)
      .where(and(eq(integrations.provider, "email"), eq(integrations.externalAccountId, address), eq(integrations.status, "active")))
      .limit(1);
    const integration = integrationRows[0];
    if (!integration) continue;

    const existingConversation = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(
          eq(conversations.businessId, integration.businessId),
          eq(conversations.integrationId, integration.id),
          eq(conversations.customerEmail, normalizedFrom),
        ),
      )
      .limit(1);

    if (existingConversation[0]) {
      return {
        classification: "MATCHED_CONTACT",
        businessId: integration.businessId,
        integrationId: integration.id,
        conversationId: existingConversation[0].id,
      };
    }

    return {
      classification: "NEW_CONVERSATION",
      businessId: integration.businessId,
      integrationId: integration.id,
    };
  }
  return null;
}

export async function correlateInboundEmail(params: {
  to: string[];
  from: string;
}): Promise<InboundCorrelation> {
  const tokenMatch = await findReplyTokenMatch(params.to);
  if (tokenMatch) return tokenMatch;

  const aliasMatch = await findBusinessAliasMatch(params.to, params.from);
  if (aliasMatch) return aliasMatch;

  return { classification: "UNMATCHED_REVIEW_REQUIRED" };
}
