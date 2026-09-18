import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, conversations, integrations, messages } from "@/db/schema";
import {
  getWhatsAppProviderConfig,
  getWhatsAppTransportProvider,
  sendWhatsAppViaProvider,
  type WhatsAppProviderConfig,
} from "@/lib/channels/whatsapp-provider";

import type { ChannelAdapter } from "./types";

/*
 * Canonical WhatsApp channel module.
 *
 * Every WhatsApp send in the app — the generic channel adapter, the
 * webhook's auto-reply, human-triggered follow-up sends, and approved
 * action-approval executions — goes through sendWhatsAppText() with
 * credentials resolved per-tenant here. Nothing else in the codebase
 * should read WHATSAPP_ACCESS_TOKEN directly to send a message.
 */

const DEFAULT_GRAPH_API_VERSION = "v25.0";

// Meta only allows unrestricted, free-form outbound messages within 24 hours
// of the customer's most recent inbound message ("customer service window").
// Outside that window a message template is required instead.
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type WhatsAppCredentials =
  WhatsAppProviderConfig;

export interface WhatsAppIntegrationRecord {
  id: string;
  businessId: string;
  externalPhoneNumberId: string | null;
  credentialsEncrypted: string | null;
  metadata: string | null;
}

/**
 * Verify a Meta webhook POST body using the app secret. Requires the exact
 * raw request bytes (never a re-serialized/parsed body) and compares with
 * crypto.timingSafeEqual to avoid leaking timing information about the
 * expected signature.
 */
export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
): boolean {
  if (!appSecret || !signatureHeader) {
    return false;
  }

  const expected =
    "sha256=" +
    crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/**
 * Resolve the SuperKuba tenant that owns a Meta WhatsApp phone number.
 *
 * Never trust a business ID supplied by a webhook request, query string, or
 * environment variable — a Meta phone_number_id must belong to exactly one
 * registered, active integration.
 */
export async function resolveWhatsAppIntegrationByPhoneNumberId(
  phoneNumberId: string,
) {
  const result = await db
    .select({ integration: integrations, business: businesses })
    .from(integrations)
    .innerJoin(businesses, eq(integrations.businessId, businesses.id))
    .where(
      and(
        eq(integrations.provider, "whatsapp"),
        eq(integrations.externalPhoneNumberId, phoneNumberId),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Idempotency lookup for inbound webhook processing: a message id is only
 * unique within a given integration, so a duplicate check must always be
 * scoped by integrationId, never by externalMessageId alone.
 */
/**
 * Resolve the active WATI integration that owns a canonical
 * WhatsApp channel number.
 *
 * WATI payload business identifiers are never trusted.
 * Tenant ownership comes exclusively from the stored,
 * authenticated SuperKuba integration.
 */
export async function resolveWatiWhatsAppIntegrationByChannelNumber(
  channelNumber: string,
) {
  const normalizedChannelNumber =
    String(channelNumber || "")
      .replace(/\D/g, "")
      .trim();

  if (!normalizedChannelNumber) {
    return null;
  }

  const candidates = await db
    .select({
      integration: integrations,
      business: businesses,
    })
    .from(integrations)
    .innerJoin(
      businesses,
      eq(integrations.businessId, businesses.id),
    )
    .where(
      and(
        eq(integrations.provider, "whatsapp"),
        eq(integrations.status, "active"),
      ),
    );

  for (const candidate of candidates) {
    if (
      getWhatsAppTransportProvider(
        candidate.integration,
      ) !== "wati"
    ) {
      continue;
    }

    const storedChannelNumber =
      String(
        candidate.integration.externalPhoneNumberId ||
          "",
      )
        .replace(/\D/g, "")
        .trim();

    if (
      storedChannelNumber ===
      normalizedChannelNumber
    ) {
      return candidate;
    }
  }

  return null;
}

export async function findWhatsAppMessageByExternalId(
  integrationId: string,
  externalMessageId: string,
) {
  const result = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.integrationId, integrationId),
        eq(messages.externalMessageId, externalMessageId),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Resolve a business's own active WhatsApp integration. Used by outbound
 * send paths (human agent replies, AI tool-initiated sends) that only know
 * the trusted businessId, never a Meta phone_number_id.
 */
export async function updateWhatsAppMessageStatus(params: {
  integrationId: string;
  externalMessageId: string;
  status: string;
}): Promise<void> {
  const integrationId = params.integrationId.trim();
  const externalMessageId = params.externalMessageId.trim();
  const status = params.status.trim();

  if (!integrationId || !externalMessageId || !status) {
    return;
  }

  await db
    .update(messages)
    .set({
      status,
      statusUpdatedAt: new Date(),
    })
    .where(
      and(
        eq(messages.integrationId, integrationId),
        eq(messages.externalMessageId, externalMessageId),
      ),
    );
}

export async function resolveWhatsAppIntegrationByBusinessId(
  businessId: string,
) {
  const result = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.businessId, businessId),
        eq(integrations.provider, "whatsapp"),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Resolve the credentials to use for a specific WhatsApp integration.
 *
 * Each tenant's own encrypted access token takes priority so multiple
 * businesses can each connect their own Meta WhatsApp Business number. A
 * shared env-var token/number is only a fallback for the single-number
 * staging setup and must never override a tenant's own connection — and
 * never falls back across a different phone number than the one those env
 * vars actually configure, so a partially-connected integration can never
 * silently send through the wrong Meta number.
 */
export function getWhatsAppCredentialsForIntegration(
  integration: WhatsAppIntegrationRecord,
): WhatsAppCredentials | null {
  return getWhatsAppProviderConfig(integration);
}

/**
 * Whether a free-form (non-template) reply is currently permitted under
 * Meta's customer-service-window policy.
 */
export function isWithinCustomerServiceWindow(
  lastInboundMessageAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!lastInboundMessageAt) {
    return false;
  }

  return now.getTime() - lastInboundMessageAt.getTime() <= CUSTOMER_SERVICE_WINDOW_MS;
}

/**
 * The one place that actually calls the Meta Graph API to send a WhatsApp
 * text message.
 */
export async function sendWhatsAppText(
  credentials: WhatsAppCredentials,
  to: string,
  message: string,
): Promise<{
  success: boolean;
  externalMessageId?: string;
  error?: string;
}> {
  return sendWhatsAppViaProvider(
    credentials,
    to,
    message,
  );
}

async function getLastInboundMessageAt(conversationId: string) {
  const result = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, "inbound"),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return result[0]?.createdAt ?? null;
}

async function getLastInboundMessageAtForPhone(
  businessId: string,
  phone: string,
) {
  const result = await db
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.businessId, businessId),
        eq(conversations.customerPhone, phone),
        eq(messages.direction, "inbound"),
      ),
    )
    .orderBy(desc(messages.createdAt))
    .limit(1);

  return result[0]?.createdAt ?? null;
}

interface WhatsAppSendOutcome {
  success: boolean;
  externalMessageId?: string;
  error?: string;
}

async function performTenantScopedSend(
  businessId: string,
  lastInboundAt: Date | null,
  recipient: string,
  message: string,
): Promise<WhatsAppSendOutcome> {
  const integration = await resolveWhatsAppIntegrationByBusinessId(businessId);

  if (!integration) {
    return { success: false, error: "not_connected" };
  }

  if (!isWithinCustomerServiceWindow(lastInboundAt)) {
    return { success: false, error: "customer_service_window_expired" };
  }

  const credentials = getWhatsAppCredentialsForIntegration(integration);

  if (!credentials) {
    return { success: false, error: "not_configured" };
  }

  return sendWhatsAppText(credentials, recipient, message);
}

/**
 * Send a WhatsApp text to a specific phone number on behalf of a business,
 * used by AI-tool-initiated outreach (e.g. Sales messaging a lead) where
 * only a businessId + phone number are known, not a conversation record.
 */
export async function sendWhatsAppToPhone(params: {
  businessId: string;
  phone: string;
  message: string;
}): Promise<WhatsAppSendOutcome> {
  const lastInboundAt = await getLastInboundMessageAtForPhone(
    params.businessId,
    params.phone,
  );

  return performTenantScopedSend(
    params.businessId,
    lastInboundAt,
    params.phone,
    params.message,
  );
}

export const whatsappAdapter: ChannelAdapter = {
  async send(payload) {
    const lastInboundAt = await getLastInboundMessageAt(payload.conversationId);

    const result = await performTenantScopedSend(
      payload.businessId,
      lastInboundAt,
      payload.recipient,
      payload.message,
    );

    if (!result.success) {
      console.error("WhatsApp channel adapter send failed:", result.error);
    }

    return {
      success: result.success,
      externalMessageId: result.externalMessageId,
    };
  },
};
