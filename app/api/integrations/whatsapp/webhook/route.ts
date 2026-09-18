import { NextResponse } from "next/server";

import {
  resolveWhatsAppIntegrationByPhoneNumberId,
  verifyMetaSignature,
} from "@/lib/channels/whatsapp";
import {
  processWhatsAppInbound,
  type NormalizedWhatsAppStatusUpdate,
} from "@/lib/channels/whatsapp-inbound";
import { safeCompareSecret } from "@/lib/auth/secret-comparison";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

function extractCustomerContent(
  incomingMessage: Record<string, unknown>,
  messageType: string,
): {
  content: string;
  canGenerateAiReply: boolean;
} {
  if (messageType === "text") {
    const text = incomingMessage as {
      text?: { body?: string };
    };

    return {
      content: String(text.text?.body || "").trim(),
      canGenerateAiReply: true,
    };
  }

  if (messageType === "interactive") {
    const interactive = incomingMessage as {
      interactive?: {
        button_reply?: { title?: string };
        list_reply?: { title?: string };
      };
    };

    const title =
      interactive.interactive?.button_reply?.title ||
      interactive.interactive?.list_reply?.title ||
      "";

    return {
      content: title.trim(),
      canGenerateAiReply: true,
    };
  }

  return {
    content:
      `[Customer sent a "${messageType}" message. ` +
      `Viewing this content type is not yet supported — ` +
      `a human should follow up.]`,
    canGenerateAiReply: false,
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    challenge &&
    safeCompareSecret(token, VERIFY_TOKEN)
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    const signature = request.headers.get(
      "x-hub-signature-256",
    );

    if (
      !verifyMetaSignature(
        rawBody,
        signature,
        process.env.WHATSAPP_APP_SECRET,
      )
    ) {
      console.error(
        "Invalid WhatsApp webhook signature.",
      );

      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      );
    }

    const body = JSON.parse(rawBody);

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true });
    }

    const value =
      body.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      return NextResponse.json({ received: true });
    }

    const incomingPhoneNumberId =
      value.metadata?.phone_number_id ||
      PHONE_NUMBER_ID;

    if (!incomingPhoneNumberId) {
      return NextResponse.json(
        {
          error:
            "WhatsApp phone number is not configured.",
        },
        { status: 400 },
      );
    }

    // Never trust a business ID supplied by the webhook.
    // Tenant identity comes exclusively from the registered
    // WhatsApp external phone identity.
    const resolved =
      await resolveWhatsAppIntegrationByPhoneNumberId(
        incomingPhoneNumberId,
      );

    if (!resolved) {
      return NextResponse.json(
        {
          error:
            "WhatsApp number is not registered with Kuba.",
        },
        { status: 404 },
      );
    }

    if (resolved.business.status !== "active") {
      return NextResponse.json(
        { error: "Kuba business is inactive." },
        { status: 403 },
      );
    }

    const statusUpdates: NormalizedWhatsAppStatusUpdate[] =
      Array.isArray(value.statuses)
        ? value.statuses
            .map(
              (status: {
                id?: string;
                status?: string;
              }) => ({
                externalMessageId: String(
                  status.id || "",
                ).trim(),
                status: String(
                  status.status || "",
                ).trim(),
              }),
            )
            .filter(
              (
                status: NormalizedWhatsAppStatusUpdate,
              ) =>
                Boolean(
                  status.externalMessageId &&
                    status.status,
                ),
            )
        : [];

    const incomingMessage = value.messages?.[0];

    let normalizedMessage = null;

    if (incomingMessage) {
      const customerPhone = String(
        incomingMessage.from || "",
      ).trim();

      const externalMessageId = String(
        incomingMessage.id || "",
      ).trim();

      const messageType = String(
        incomingMessage.type || "text",
      );

      const extracted = extractCustomerContent(
        incomingMessage,
        messageType,
      );

      if (
        customerPhone &&
        externalMessageId &&
        extracted.content
      ) {
        normalizedMessage = {
          customerPhone,
          externalMessageId,
          messageType,
          customerMessage: extracted.content,
          customerName:
            value.contacts?.[0]?.profile?.name ||
            customerPhone,
          canGenerateAiReply:
            extracted.canGenerateAiReply,
        };
      }
    }

    const result = await processWhatsAppInbound({
      resolved,
      statusUpdates,
      incomingMessage: normalizedMessage,
    });

    return NextResponse.json(
      result.body,
      { status: result.status },
    );
  } catch (error) {
    console.error(
      "WhatsApp webhook error:",
      error,
    );

    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }
}
