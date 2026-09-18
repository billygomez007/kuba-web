import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  integrations,
} from "@/db/schema";

import {
  resolveWhatsAppIntegrationByPhoneNumberId,
  updateWhatsAppMessageStatus,
  verifyMetaSignature,
} from "@/lib/channels/whatsapp";
import { processWhatsAppInboundMessage } from "@/lib/channels/whatsapp-inbound";
import { safeCompareSecret } from "@/lib/auth/security";


const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Message types SuperKuba can extract customer intent from today and hand
// to an AI employee. Anything else is stored so it appears in the Unified
// Inbox for a human to review, but never fabricated content for the AI to
// respond to.
const TEXT_LIKE_MESSAGE_TYPES = new Set(["text", "interactive"]);

function extractCustomerContent(
  incomingMessage: Record<string, unknown>,
  messageType: string,
): { content: string; canGenerateAiReply: boolean } {
  const canGenerateAiReply = TEXT_LIKE_MESSAGE_TYPES.has(messageType);

  if (messageType === "text") {
    const text = incomingMessage as { text?: { body?: string } };
    return {
      content: String(text.text?.body || "").trim(),
      canGenerateAiReply,
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
    return { content: title.trim(), canGenerateAiReply };
  }

  // image, document, audio, video, sticker, location, contacts, and any
  // other type: acknowledge and log for the Unified Inbox, but do not
  // pretend the AI can see content it was never given.
  return {
    content: `[Customer sent a "${messageType}" message. Viewing this content type is not yet supported — a human should follow up.]`,
    canGenerateAiReply: false,
  };
}

/**
 * Meta webhook verification
 */
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

/**
 * Receive WhatsApp messages and status callbacks from Meta.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    const signature = request.headers.get("x-hub-signature-256");

    if (!verifyMetaSignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
      console.error("Invalid WhatsApp webhook signature.");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true });
    }

    const value = body.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      return NextResponse.json({ received: true });
    }

    const incomingPhoneNumberId =
      value.metadata?.phone_number_id || PHONE_NUMBER_ID;

    if (!incomingPhoneNumberId) {
      console.error("WhatsApp phone number ID is missing.");
      return NextResponse.json(
        { error: "WhatsApp phone number is not configured." },
        { status: 400 },
      );
    }

    /**
     * Resolve the tenant exclusively from the
     * registered WhatsApp phone number.
     *
     * Never trust a business ID supplied by the
     * webhook request or environment variables.
     */
    const resolved = await resolveWhatsAppIntegrationByPhoneNumberId(
      incomingPhoneNumberId,
    );

    if (!resolved) {
      console.error("Unregistered WhatsApp phone number:", incomingPhoneNumberId);
      return NextResponse.json(
        { error: "WhatsApp number is not registered with Kuba." },
        { status: 404 },
      );
    }

    const integration = resolved.integration;
    const business = resolved.business;
    const businessId = business.id;

    if (business.status !== "active") {
      console.error("WhatsApp business is inactive:", businessId);
      return NextResponse.json(
        { error: "Kuba business is inactive." },
        { status: 403 },
      );
    }

    /**
     * Connection-health signal: a signature-verified webhook for a known,
     * active tenant proves this integration is genuinely receiving Meta
     * traffic, independent of whatever the payload actually contains.
     */
    await db
      .update(integrations)
      .set({ lastWebhookAt: new Date() })
      .where(eq(integrations.id, integration.id));

    /**
     * Message status callbacks (sent/delivered/read/failed).
     *
     * These are not customer messages — map them onto the outbound message
     * we already stored, matched by Meta's message id, and acknowledge.
     * Meta may send this independently of any inbound customer message.
     */
    if (Array.isArray(value.statuses) && value.statuses.length > 0) {
      for (const statusUpdate of value.statuses) {
        const statusExternalId = String(statusUpdate?.id || "").trim();
        const status = String(statusUpdate?.status || "").trim();

        if (!statusExternalId || !status) {
          continue;
        }

        await updateWhatsAppMessageStatus({
          integrationId: integration.id,
          externalMessageId: statusExternalId,
          status,
        });
      }

      return NextResponse.json({ received: true });
    }

    const incomingMessage = value.messages?.[0];

    if (!incomingMessage) {
      return NextResponse.json({ received: true });
    }

    const customerPhone = String(incomingMessage.from || "").trim();
    const externalMessageId = String(incomingMessage.id || "").trim();
    const messageType = String(incomingMessage.type || "text");

    if (!customerPhone || !externalMessageId) {
      return NextResponse.json({ received: true });
    }

    const { content: customerMessage, canGenerateAiReply } =
      extractCustomerContent(incomingMessage, messageType);

    if (!customerMessage) {
      return NextResponse.json({ received: true });
    }

    const customerName = value.contacts?.[0]?.profile?.name || customerPhone;

    /**
     * Prevent duplicate processing if Meta retries a webhook.
     */
    const processingResult =
      await processWhatsAppInboundMessage({
        resolved,
        incomingMessage: {
          customerPhone,
          externalMessageId,
          messageType,
          customerMessage,
          customerName,
          canGenerateAiReply,
        },
      });

    return NextResponse.json(
      processingResult.body,
      { status: processingResult.status },
    );
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }
}
