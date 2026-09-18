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

const DEFAULT_GRAPH_API_VERSION = "v22.0";

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
  const transportProvider = getWhatsAppTransportProvider(integration);

  const accessToken = integration.credentialsEncrypted
    ? decrypt(integration.credentialsEncrypted)
    : transportProvider === "meta"
      ? process.env.WHATSAPP_ACCESS_TOKEN
      : null;

  if (!accessToken) {
    return null;
  }

  if (transportProvider === "wati") {
    const metadata = parseMetadata(integration.metadata);
    const apiBaseUrl = normalizeWatiBaseUrl(metadata.apiBaseUrl);

    if (!apiBaseUrl) {
      return null;
    }

    return {
      provider: "wati",
      accessToken,
      apiBaseUrl,
      channelNumber:
        typeof metadata.channelNumber === "string" &&
        metadata.channelNumber.trim()
          ? metadata.channelNumber.trim()
          : null,
    };
  }

  const phoneNumberId =
    integration.externalPhoneNumberId ||
    process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!phoneNumberId) {
    return null;
  }

  return {
    provider: "meta",
    accessToken,
    phoneNumberId,
    graphApiVersion:
      process.env.WHATSAPP_GRAPH_API_VERSION ||
      DEFAULT_GRAPH_API_VERSION,
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
    `/api/ext/v3/conversations/messages/text` +
    `?whatsappNumber=${encodeURIComponent(recipient)}`;

  const body: Record<string, string> = {
    text: message,
  };

  if (config.channelNumber) {
    body.channelNumber = config.channelNumber;
  }

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("WhatsApp WATI send rejected.");
    return { success: false, error: "provider_rejected" };
  }

  // WATI delivery-status webhooks correlate outbound messages using
  // localMessageId. Persist that identifier whenever WATI returns it so
  // delivered/read/failed callbacks can update the exact stored message.
  //
  // Keep the older response shapes as compatibility fallbacks only.
  const externalMessageId =
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
