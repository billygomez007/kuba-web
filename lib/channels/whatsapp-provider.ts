import { decrypt } from "@/lib/encryption";

export type WhatsAppTransportProvider = "meta" | "wati";

export interface WhatsAppIntegrationRecord {
  externalPhoneNumberId: string | null;
  credentialsEncrypted: string | null;
  metadata: string | null;
}

export interface MetaWhatsAppProviderConfig {
  provider: "meta";
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
}

export interface WatiWhatsAppProviderConfig {
  provider: "wati";
  accessToken: string;
  apiBaseUrl: string;
  channelNumber: string | null;
}

export type WhatsAppProviderConfig =
  | MetaWhatsAppProviderConfig
  | WatiWhatsAppProviderConfig;

type WhatsAppMetadata = {
  transportProvider?: unknown;
  apiBaseUrl?: unknown;
  channelNumber?: unknown;
};

const DEFAULT_GRAPH_API_VERSION = "v25.0";

function parseMetadata(metadata: string | null): WhatsAppMetadata {
  if (!metadata) return {};

  try {
    const parsed = JSON.parse(metadata);

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as WhatsAppMetadata;
  } catch {
    return {};
  }
}

function normalizeWatiBaseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const candidate = value.trim().replace(/\/+$/, "");

  if (!candidate) return null;

  try {
    const url = new URL(candidate);

    if (url.protocol !== "https:") return null;

    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function getWhatsAppTransportProvider(
  integration: Pick<WhatsAppIntegrationRecord, "metadata">,
): WhatsAppTransportProvider {
  const metadata = parseMetadata(integration.metadata);

  return metadata.transportProvider === "wati"
    ? "wati"
    : "meta";
}

export function getWhatsAppProviderConfig(
  integration: WhatsAppIntegrationRecord,
): WhatsAppProviderConfig | null {
  const transportProvider =
    getWhatsAppTransportProvider(integration);

  if (transportProvider === "wati") {
    if (!integration.credentialsEncrypted) {
      return null;
    }

    const metadata =
      parseMetadata(integration.metadata);

    const apiBaseUrl =
      normalizeWatiBaseUrl(metadata.apiBaseUrl);

    if (!apiBaseUrl) {
      return null;
    }

    const channelNumber =
      typeof metadata.channelNumber === "string" &&
      metadata.channelNumber.trim()
        ? metadata.channelNumber.trim()
        : null;

    if (!channelNumber) {
      return null;
    }

    return {
      provider: "wati",
      accessToken:
        decrypt(integration.credentialsEncrypted),
      apiBaseUrl,
      channelNumber,
    };
  }

  const graphApiVersion =
    process.env.WHATSAPP_GRAPH_API_VERSION ||
    DEFAULT_GRAPH_API_VERSION;

  /*
   * Preserve production's existing Meta tenant-safety invariant.
   *
   * A tenant-specific encrypted credential is only used together
   * with that tenant's stored phone number.
   */
  if (
    integration.credentialsEncrypted &&
    integration.externalPhoneNumberId
  ) {
    return {
      provider: "meta",
      accessToken:
        decrypt(integration.credentialsEncrypted),
      phoneNumberId:
        integration.externalPhoneNumberId,
      graphApiVersion,
    };
  }

  /*
   * Legacy environment fallback remains available only for the
   * exact global Meta number it belongs to. Never cross-wire a
   * tenant integration to some other environment-configured number.
   */
  const legacyAccessToken =
    process.env.WHATSAPP_ACCESS_TOKEN;

  const legacyPhoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (
    !legacyAccessToken ||
    !legacyPhoneNumberId ||
    (
      integration.externalPhoneNumberId &&
      integration.externalPhoneNumberId !==
        legacyPhoneNumberId
    )
  ) {
    return null;
  }

  return {
    provider: "meta",
    accessToken: legacyAccessToken,
    phoneNumberId: legacyPhoneNumberId,
    graphApiVersion,
  };
}

export async function sendWhatsAppViaProvider(
  config: WhatsAppProviderConfig,
  recipient: string,
  message: string,
): Promise<{
  success: boolean;
  externalMessageId?: string;
  error?: string;
}> {
  if (config.provider === "meta") {
    const response = await fetch(
      `https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
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
      console.error("WhatsApp Meta send rejected.");
      return { success: false, error: "provider_rejected" };
    }

    const externalMessageId = result.messages?.[0]?.id;

    if (!externalMessageId) {
      return { success: false, error: "no_message_id" };
    }

    return { success: true, externalMessageId };
  }

  const path =
    `/api/ext/v3/conversations/messages/text`;

  const target =
    config.channelNumber
      ? `${config.channelNumber}:${recipient}`
      : recipient;

  const body = {
    target,
    text: message,
  };

  const apiUrl = new URL(config.apiBaseUrl);

  /*
   * WATI's dashboard may expose an account-specific endpoint such as:
   * https://live-mt-server.wati.io/12345678
   *
   * V3 endpoints live at the host root. Tenant/channel identity is carried
   * by the V3 target value rather than by the account path segment.
   */
  const v3BaseUrl = `${apiUrl.protocol}//${apiUrl.host}`;

  const response = await fetch(`${v3BaseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const providerError =
      result && typeof result === "object"
        ? JSON.stringify(result).slice(0, 1000)
        : "unavailable";

    console.error("WhatsApp WATI send rejected.", {
      status: response.status,
      statusText: response.statusText,
      providerError,
    });

    return { success: false, error: "provider_rejected" };
  }

  // The documented v3 "send text message to an active conversation"
  // response wraps the created message as { message: { id, ... } }
  // (https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-text) —
  // none of the previously-checked shapes below ever matched that nested
  // field, so a successful send always fell through to "no_message_id"
  // and was reported to the user as a failed send even though WATI had
  // already delivered the message. result.message.id is WATI's own
  // internal identifier for the message, which is what its delivery-status
  // webhooks correlate back to (as opposed to whatsappMessageId, which is
  // Meta's own WAMID) — the same identifier family the older
  // localMessageId-first fallback below was already written for.
  //
  // Keep the older, previously-checked response shapes as compatibility
  // fallbacks only, in case a different WATI response variant is ever hit.
  const externalMessageId =
    result?.message?.id ||
    result?.localMessageId ||
    result?.data?.localMessageId ||
    result?.messageId ||
    result?.data?.messageId ||
    result?.id ||
    result?.data?.id;

  if (!externalMessageId) {
    return { success: false, error: "no_message_id" };
  }

  return {
    success: true,
    externalMessageId: String(externalMessageId),
  };
}
