import crypto from "crypto";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, conversations, integrations, messages } from "@/db/schema";
import { decrypt } from "@/lib/encryption";

import type { ChannelAdapter } from "./types";

const DEFAULT_GRAPH_API_VERSION = "v25.0";

// Meta only allows unrestricted, free-form outbound messages within 24 hours
// of the customer's most recent inbound message ("customer service window").
// Outside that window a message template is required instead.
const CUSTOMER_SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export interface WhatsAppCredentials {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
}

export interface WhatsAppIntegrationRecord {
  id: string;
  businessId: string;
  externalPhoneNumberId: string | null;
  credentialsEncrypted: string | null;
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
 * Resolve a business's own active WhatsApp integration. Used by outbound
 * send paths (human agent replies, AI tool-initiated sends) that only know
 * the trusted businessId, never a Meta phone_number_id.
 */
/**
 * Idempotency lookup for inbound webhook processing: a message id is only
 * unique within a given integration, so a duplicate check must always be
 * scoped by integrationId, never by externalMessageId alone.
 */
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
 * businesses can each connect their own Meta WhatsApp Business number.
 * A shared env-var token/number is only a fallback for the single-number
 * staging setup and must never override a tenant's own connection.
 */
export function getWhatsAppCredentialsForIntegration(
  integration: WhatsAppIntegrationRecord,
): WhatsAppCredentials | null {
  const accessToken = integration.credentialsEncrypted
    ? decrypt(integration.credentialsEncrypted)
    : process.env.WHATSAPP_ACCESS_TOKEN;

  const phoneNumberId =
    integration.externalPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID;

  const graphApiVersion =
    process.env.WHATSAPP_GRAPH_API_VERSION || DEFAULT_GRAPH_API_VERSION;

  if (!accessToken || !phoneNumberId) {
    return null;
  }

  return { accessToken, phoneNumberId, graphApiVersion };
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
 * Send a free-form WhatsApp text message via the Graph API using explicit,
 * already-resolved credentials. Never reads env vars directly so callers
 * cannot accidentally bypass per-tenant credential resolution.
 */
export async function sendWhatsAppText(
  credentials: WhatsAppCredentials,
  recipient: string,
  message: string,
): Promise<{ success: boolean; externalMessageId?: string; error?: string }> {
  const response = await fetch(
    `https://graph.facebook.com/${credentials.graphApiVersion}/${credentials.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: recipient,
        type: "text",
        text: {
          preview_url: false,
          body: message,
        },
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    console.error("WhatsApp send error:", JSON.stringify(result, null, 2));
    return { success: false, error: "provider_rejected" };
  }

  const externalMessageId = result.messages?.[0]?.id;

  if (!externalMessageId) {
    return { success: false, error: "no_message_id" };
  }

  return { success: true, externalMessageId };
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
