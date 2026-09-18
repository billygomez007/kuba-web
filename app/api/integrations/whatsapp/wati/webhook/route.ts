import { NextRequest, NextResponse } from "next/server";

import {
  resolveWhatsAppIntegrationByPhoneNumberId,
} from "@/lib/channels/whatsapp";
import {
  processWhatsAppInbound,
  type NormalizedWhatsAppInboundMessage,
  type NormalizedWhatsAppStatusUpdate,
} from "@/lib/channels/whatsapp-inbound";
import {
  getWhatsAppTransportProvider,
} from "@/lib/channels/whatsapp-provider";

type WatiWebhookPayload = {
  eventType?: unknown;
  type?: unknown;
  channelPhoneNumber?: unknown;
  whatsappNumber?: unknown;
  waId?: unknown;
  senderPhone?: unknown;
  from?: unknown;
  id?: unknown;
  messageId?: unknown;
  whatsappMessageId?: unknown;
  localMessageId?: unknown;
  text?: unknown;
  messageText?: unknown;
  data?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function nestedString(
  record: Record<string, unknown> | null,
  key: string,
): string {
  return record ? asString(record[key]) : "";
}

function normalizePhone(value: unknown): string {
  return asString(value).replace(/[^\d]/g, "");
}

function getEventType(payload: WatiWebhookPayload): string {
  return (
    asString(payload.eventType) ||
    asString(payload.type)
  );
}

function getChannelPhoneNumber(
  payload: WatiWebhookPayload,
): string {
  const data = asRecord(payload.data);

  return normalizePhone(
    payload.channelPhoneNumber ||
      payload.whatsappNumber ||
      data?.channelPhoneNumber ||
      data?.whatsappNumber,
  );
}

function normalizeIncomingMessage(
  payload: WatiWebhookPayload,
): NormalizedWhatsAppInboundMessage | null {
  const data = asRecord(payload.data);
  const textRecord = asRecord(payload.text);

  const externalMessageId =
    asString(payload.whatsappMessageId) ||
    asString(payload.messageId) ||
    asString(payload.id) ||
    nestedString(data, "whatsappMessageId") ||
    nestedString(data, "messageId") ||
    nestedString(data, "id");

  const senderPhone = normalizePhone(
    payload.waId ||
      payload.senderPhone ||
      payload.from ||
      data?.waId ||
      data?.senderPhone ||
      data?.from,
  );

  const text =
    asString(payload.messageText) ||
    asString(payload.text) ||
    nestedString(textRecord, "body") ||
    nestedString(data, "messageText") ||
    nestedString(data, "text");

  if (!externalMessageId || !senderPhone) {
    return null;
  }

  return {
    customerPhone: senderPhone,
    externalMessageId,
    messageType: text ? "text" : "unsupported",
    customerMessage:
      text ||
      "Viewing this content type is not yet supported.",
    customerName: senderPhone,
    canGenerateAiReply: Boolean(text),
  };
}

function normalizeStatus(
  payload: WatiWebhookPayload,
): NormalizedWhatsAppStatusUpdate | null {
  const eventType = getEventType(payload);
  const data = asRecord(payload.data);

  const statusByEvent: Record<string, string> = {
    sentMessageDELIVERED_v2: "delivered",
    sentMessageREAD_v2: "read",
    sentMessageFAILED_v2: "failed",
  };

  const status = statusByEvent[eventType];

  if (!status) {
    return null;
  }

  /*
   * WATI status callbacks may correlate using either the provider's
   * WhatsApp message ID or its local message ID. Prefer the WhatsApp ID
   * because outbound sends persist the provider message ID when available.
   */
  const externalMessageId =
    asString(payload.whatsappMessageId) ||
    nestedString(data, "whatsappMessageId") ||
    asString(payload.localMessageId) ||
    nestedString(data, "localMessageId") ||
    asString(payload.messageId) ||
    nestedString(data, "messageId") ||
    asString(payload.id) ||
    nestedString(data, "id");

  if (!externalMessageId) {
    return null;
  }

  return {
    externalMessageId,
    status,
  };
}

export async function POST(request: NextRequest) {
  /*
   * WATI's public webhook documentation used for this integration does not
   * document a Meta-style HMAC signature contract. Do not invent one here.
   *
   * Tenant identity is therefore never accepted from the webhook payload.
   * The only tenant lookup key is the WATI channelPhoneNumber previously
   * registered by an authenticated SuperKuba business.
   */

  let payload: WatiWebhookPayload;

  try {
    payload = (await request.json()) as WatiWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }

  const eventType = getEventType(payload);

  const isMessageReceived = eventType === "messageReceived";
  const statusUpdate = normalizeStatus(payload);

  if (!isMessageReceived && !statusUpdate) {
    return NextResponse.json({
      received: true,
      ignored: true,
    });
  }

  const channelPhoneNumber =
    getChannelPhoneNumber(payload);

  if (!channelPhoneNumber) {
    return NextResponse.json(
      { error: "Missing WATI channel phone number" },
      { status: 400 },
    );
  }

  const resolved =
    await resolveWhatsAppIntegrationByPhoneNumberId(
      channelPhoneNumber,
    );

  if (
    !resolved ||
    resolved.business.status !== "active" ||
    getWhatsAppTransportProvider(
      resolved.integration,
    ) !== "wati"
  ) {
    return NextResponse.json(
      { error: "Unknown WhatsApp connection" },
      { status: 404 },
    );
  }

  if (statusUpdate) {
    const result = await processWhatsAppInbound({
      resolved,
      statusUpdates: [statusUpdate],
    });

    return NextResponse.json(
      result.body,
      { status: result.status },
    );
  }

  const incomingMessage =
    normalizeIncomingMessage(payload);

  if (!incomingMessage) {
    return NextResponse.json(
      { error: "Invalid WATI message event" },
      { status: 400 },
    );
  }

  const result = await processWhatsAppInbound({
    resolved,
    incomingMessage,
  });

  return NextResponse.json(
    result.body,
    { status: result.status },
  );

}
