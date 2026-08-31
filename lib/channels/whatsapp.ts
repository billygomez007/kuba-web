import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, integrations, messages } from "@/db/schema";
import { decrypt } from "@/lib/encryption";

import { ChannelAdapter } from "./types";

/*
 * Canonical WhatsApp channel module.
 *
 * Every WhatsApp send in the app — the generic channel adapter, the
 * webhook's auto-reply, human-triggered follow-up sends, and approved
 * action-approval executions — goes through sendWhatsAppText() with
 * credentials resolved per-tenant here. Nothing else in the codebase
 * should read WHATSAPP_ACCESS_TOKEN directly to send a message.
 */

type WhatsAppCredentials = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
};

/**
 * Resolves the real credentials to send with, for an already-loaded
 * integration row. Prefers the business's own encrypted credentials
 * (stored when they connected their WhatsApp number via
 * app/api/integrations/whatsapp/route.ts). Falls back to the legacy global
 * env vars only when this integration has no stored credentials of its
 * own — for installations connected before per-tenant credential storage
 * existed — and only for the same phone number those env vars configure.
 */
export function getWhatsAppCredentialsForIntegration(integration: {
  credentialsEncrypted: string | null;
  externalPhoneNumberId: string | null;
}): WhatsAppCredentials | null {
  const graphApiVersion =
    process.env.WHATSAPP_GRAPH_API_VERSION || "v25.0";

  if (
    integration.credentialsEncrypted &&
    integration.externalPhoneNumberId
  ) {
    return {
      accessToken: decrypt(integration.credentialsEncrypted),
      phoneNumberId: integration.externalPhoneNumberId,
      graphApiVersion,
    };
  }

  const legacyAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const legacyPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (
    !legacyAccessToken ||
    !legacyPhoneNumberId ||
    (integration.externalPhoneNumberId &&
      integration.externalPhoneNumberId !== legacyPhoneNumberId)
  ) {
    return null;
  }

  return {
    accessToken: legacyAccessToken,
    phoneNumberId: legacyPhoneNumberId,
    graphApiVersion,
  };
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
        to,
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
    console.error(
      "WhatsApp send error:",
      JSON.stringify(result, null, 2),
    );

    return {
      success: false,
      error: result?.error?.message || "WhatsApp message could not be sent.",
    };
  }

  const externalMessageId = result.messages?.[0]?.id;

  if (!externalMessageId) {
    return {
      success: false,
      error: "WhatsApp did not return a message id.",
    };
  }

  return {
    success: true,
    externalMessageId,
  };
}

/**
 * Resolves which tenant a webhook delivery belongs to, from Meta's
 * phone_number_id — the only signal ever trusted for tenant resolution on
 * inbound WhatsApp webhooks. Never resolve tenant from a payload-supplied
 * businessId or an env var.
 */
export async function resolveWhatsAppIntegrationByPhoneNumberId(
  phoneNumberId: string,
) {
  const result = await db
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
        eq(integrations.externalPhoneNumberId, phoneNumberId),
        eq(integrations.status, "active"),
      ),
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Idempotency check: has this exact Meta message id already been stored
 * for this integration? Used to drop webhook retries before they insert a
 * duplicate inbound message.
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

  return result[0] || null;
}

/**
 * Convenience wrapper for callers that only have a businessId (human-
 * triggered follow-up sends, approved action-approval execution) — resolves
 * that business's own active WhatsApp integration and sends through it.
 */
export async function sendWhatsAppToPhone({
  businessId,
  phone,
  message,
}: {
  businessId: string;
  phone: string;
  message: string;
}): Promise<{
  success: boolean;
  externalMessageId?: string;
  error?: string;
}> {
  const integrationResult = await db
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

  const integration = integrationResult[0];

  if (!integration) {
    return {
      success: false,
      error: "This business does not have an active WhatsApp integration.",
    };
  }

  const credentials = getWhatsAppCredentialsForIntegration(integration);

  if (!credentials) {
    return {
      success: false,
      error: "WhatsApp credentials are not configured for this business.",
    };
  }

  return sendWhatsAppText(credentials, phone, message);
}

export const whatsappAdapter: ChannelAdapter = {
  async send(payload) {
    return sendWhatsAppToPhone({
      businessId: payload.businessId,
      phone: payload.recipient,
      message: payload.message,
    });
  },
};
