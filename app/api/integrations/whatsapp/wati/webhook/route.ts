import { NextRequest, NextResponse } from "next/server";

import { processWhatsAppInboundMessage } from "@/lib/channels/whatsapp-inbound";
import {
  resolveWatiWhatsAppIntegrationByChannelNumber,
  updateWhatsAppMessageStatus,
} from "@/lib/channels/whatsapp";
import {
  getWhatsAppTransportProvider,
} from "@/lib/channels/whatsapp-provider";
import { createAuditLog } from "@/lib/auth/audit";

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
  businessId?: unknown;
  data?: unknown;
};

function asRecord(
  value: unknown,
): Record<string, unknown> | null {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(
  value: unknown,
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function nestedString(
  record: Record<string, unknown> | null,
  key: string,
): string {
  return record
    ? asString(record[key])
    : "";
}

function normalizePhone(
  value: unknown,
): string {
  return asString(value)
    .replace(/[^\d]/g, "");
}

function getEventType(
  payload: WatiWebhookPayload,
): string {
  return (
    asString(payload.eventType) ||
    asString(payload.type)
  );
}

function getChannelPhoneNumber(
  payload: WatiWebhookPayload,
): string {
  const data =
    asRecord(payload.data);

  return normalizePhone(
    payload.channelPhoneNumber ||
      payload.whatsappNumber ||
      data?.channelPhoneNumber ||
      data?.whatsappNumber,
  );
}

function getInboundMessageId(
  payload: WatiWebhookPayload,
): string {
  const data =
    asRecord(payload.data);

  return (
    asString(payload.whatsappMessageId) ||
    asString(payload.messageId) ||
    asString(payload.id) ||
    nestedString(data, "whatsappMessageId") ||
    nestedString(data, "messageId") ||
    nestedString(data, "id")
  );
}

function getStatusMessageId(
  payload: WatiWebhookPayload,
): string {
  const data =
    asRecord(payload.data);

  return (
    asString(payload.localMessageId) ||
    nestedString(data, "localMessageId") ||
    asString(payload.whatsappMessageId) ||
    nestedString(data, "whatsappMessageId") ||
    asString(payload.messageId) ||
    nestedString(data, "messageId") ||
    asString(payload.id) ||
    nestedString(data, "id")
  );
}

function getSenderPhone(
  payload: WatiWebhookPayload,
): string {
  const data =
    asRecord(payload.data);

  return normalizePhone(
    payload.waId ||
      payload.senderPhone ||
      payload.from ||
      data?.waId ||
      data?.senderPhone ||
      data?.from,
  );
}

function getMessageText(
  payload: WatiWebhookPayload,
): string {
  const data =
    asRecord(payload.data);

  const textRecord =
    asRecord(payload.text);

  return (
    asString(payload.messageText) ||
    asString(payload.text) ||
    nestedString(textRecord, "body") ||
    nestedString(data, "messageText") ||
    nestedString(data, "text")
  );
}

const WATI_STATUS_BY_EVENT: Record<
  string,
  string
> = {
  sentMessageDELIVERED: "delivered",
  sentMessageDELIVERED_v2: "delivered",

  sentMessageREAD: "read",
  sentMessageREAD_v2: "read",

  sentMessageFAILED: "failed",
  sentMessageFAILED_v2: "failed",

  sessionMessageFAILED: "failed",
};

export async function POST(
  request: NextRequest,
) {
  /*
   * WATI's standard webhook configuration does not expose
   * a documented Meta-style request signature or custom
   * authentication header.
   *
   * Never trust businessId from this payload.
   * Tenant ownership is resolved only from the canonical
   * WATI channel phone number previously registered by an
   * authenticated SuperKuba business.
   */

  let payload: WatiWebhookPayload;

  try {
    payload =
      (await request.json()) as WatiWebhookPayload;
  } catch {
    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }

  const eventType =
    getEventType(payload);

  const diagnosticData =
    asRecord(payload.data);

  console.info("WATI webhook event-shape diagnostic", {
    eventType: eventType || null,
    topLevelEventType:
      asString(payload.eventType) || null,
    topLevelType:
      asString(payload.type) || null,
    nestedEventType:
      nestedString(diagnosticData, "eventType") || null,
    nestedType:
      nestedString(diagnosticData, "type") || null,
    topLevelKeys:
      Object.keys(payload).sort(),
    dataKeys:
      diagnosticData
        ? Object.keys(diagnosticData).sort()
        : [],
  });

  const isMessageReceived =
    eventType === "messageReceived" ||
    eventType === "message";

  const status =
    WATI_STATUS_BY_EVENT[eventType];

  if (
    !isMessageReceived &&
    !status
  ) {
    return NextResponse.json({
      received: true,
      ignored: true,
    });
  }

  const channelPhoneNumber =
    getChannelPhoneNumber(payload);

  if (!channelPhoneNumber) {
    return NextResponse.json(
      {
        error:
          "Missing WATI channel phone number",
      },
      { status: 400 },
    );
  }

  const resolved =
    await resolveWatiWhatsAppIntegrationByChannelNumber(
      channelPhoneNumber,
    );

  if (resolved) {
    const diagnosticData =
      asRecord(payload.data);

    await createAuditLog({
      businessId: resolved.business.id,
      action: "wati_webhook_event_diagnostic",
      resource: "whatsapp_integration",
      resourceId: resolved.integration.id,
      description: "Temporary WATI webhook event-shape diagnostic",
      metadata: {
        eventType: eventType || null,
        topLevelEventType:
          asString(payload.eventType) || null,
        topLevelType:
          asString(payload.type) || null,
        nestedEventType:
          nestedString(diagnosticData, "eventType") || null,
        nestedType:
          nestedString(diagnosticData, "type") || null,
        topLevelKeys:
          Object.keys(payload).sort(),
        dataKeys:
          diagnosticData
            ? Object.keys(diagnosticData).sort()
            : [],
      },
    });
  }

  if (
    !resolved ||
    resolved.business.status !== "active" ||
    getWhatsAppTransportProvider(
      resolved.integration,
    ) !== "wati"
  ) {
    return NextResponse.json(
      {
        error:
          "Unknown WhatsApp connection",
      },
      { status: 404 },
    );
  }

  /*
   * Status callbacks remain provider-bound and tenant-scoped.
   * Inbound messageReceived events are normalized here and then
   * delegated to the shared WhatsApp processing pipeline.
   */
  if (status) {
    const externalMessageId =
      getStatusMessageId(payload);

    const statusData = asRecord(payload.data);

    console.info("WATI status correlation diagnostic", {
      eventType,
      selectedExternalMessageId: externalMessageId || null,
      localMessageId:
        asString(payload.localMessageId) ||
        nestedString(statusData, "localMessageId") ||
        null,
      whatsappMessageId:
        asString(payload.whatsappMessageId) ||
        nestedString(statusData, "whatsappMessageId") ||
        null,
      messageId:
        asString(payload.messageId) ||
        nestedString(statusData, "messageId") ||
        null,
      id:
        asString(payload.id) ||
        nestedString(statusData, "id") ||
        null,
    });

    if (!externalMessageId) {
      return NextResponse.json(
        {
          error:
            "Missing WATI status message id",
        },
        { status: 400 },
      );
    }

    await updateWhatsAppMessageStatus({
      integrationId: resolved.integration.id,
      externalMessageId,
      status,
    });

    return NextResponse.json({
      received: true,
      normalized: true,
      event: "status",
      status,
    });
  }

  const externalMessageId =
    getInboundMessageId(payload);

  const customerPhone =
    getSenderPhone(payload);

  if (
    !externalMessageId ||
    !customerPhone
  ) {
    return NextResponse.json(
      {
        error:
          "Invalid WATI message event",
      },
      { status: 400 },
    );
  }

  const customerMessage =
    getMessageText(payload);

  const processingResult =
    await processWhatsAppInboundMessage({
      resolved,
      incomingMessage: {
        customerPhone,
        externalMessageId,
        messageType: "text",
        customerMessage,
        customerName:
          customerPhone,
        canGenerateAiReply:
          Boolean(customerMessage),
      },
    });

  return NextResponse.json(
    processingResult.body,
    {
      status:
        processingResult.status,
    },
  );
}
