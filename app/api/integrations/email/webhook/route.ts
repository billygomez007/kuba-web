import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployees,
  conversations,
  customers,
  integrations,
  messages,
  outreachCampaignSends,
} from "@/db/schema";

import { verifyResendWebhookSignature } from "@/lib/email/webhook-signature";
import { getInboundWebhookSecret } from "@/lib/email/inbound-config";
import { correlateInboundEmail, normalizeEmailAddress } from "@/lib/email/inbound-correlation";
import { sanitizeInboundEmailBody } from "@/lib/email/sanitize";
import { retrieveResendReceivedEmail } from "@/lib/email/resend-receiving";
import { classifyEmailProviderError } from "@/lib/email/error-classification";
import { markRecipientReplied } from "@/lib/outreach/campaign-reply-handoff";
import { addSuppression } from "@/lib/outreach/suppression";

/**
 * Canonical, single inbound-email path (Phase 4): Resend's webhook for
 * both delivery-status events (email.sent/delivered/bounced/complained)
 * and inbound email (email.received). Deliberately one endpoint, one
 * signature check, one idempotency mechanism — not a second competing
 * path per event type.
 *
 * Security: every request must carry a valid Svix signature (Resend's
 * webhook signing scheme — see lib/email/webhook-signature.ts) computed
 * over the RAW body, checked before any JSON parsing or business logic
 * runs. No public POST is ever trusted without it.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const verified = verifyResendWebhookSignature(
    rawBody,
    {
      svixId: request.headers.get("svix-id"),
      svixTimestamp: request.headers.get("svix-timestamp"),
      svixSignature: request.headers.get("svix-signature"),
    },
    getInboundWebhookSecret(),
  );

  if (!verified) {
    console.error("Invalid Resend webhook signature.");
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "email.received":
        return await handleInboundEmail(event);
      case "email.sent":
      case "email.delivered":
      case "email.delivery_delayed":
      case "email.bounced":
      case "email.complained":
        return await handleDeliveryStatusEvent(event);
      default:
        // Unhandled event type — acknowledge so Resend doesn't retry
        // forever, matching the WhatsApp webhook's grace for unknown
        // payload shapes.
        return NextResponse.json({ received: true });
    }
  } catch (error) {
    const category = classifyEmailProviderError(error);
    console.error("Email webhook processing error:", { category, eventType: event?.type });
    return NextResponse.json({ error: "Unable to process webhook.", category }, { status: 500 });
  }
}

// ---- Types (defensive — Resend's real inbound payload shape is not
// verifiable from this environment; every field is read optionally and
// the handler degrades honestly, never guessing, when a field is absent) ----

interface ResendWebhookEvent {
  type: string;
  data?: Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return [value];
  return [];
}

// ---- Delivery status events (outbound lifecycle) ----

async function handleDeliveryStatusEvent(event: ResendWebhookEvent) {
  const data = event.data ?? {};
  const externalMessageId = asString(data.email_id) ?? asString(data.id);
  if (!externalMessageId) return NextResponse.json({ received: true });

  const now = new Date();
  const statusByEventType: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.delivery_delayed": "delayed",
    "email.bounced": "bounced",
    "email.complained": "complained",
  };
  const status = statusByEventType[event.type];
  if (!status) return NextResponse.json({ received: true });

  // Campaign sends carry their own externalMessageId — update that row's
  // status honestly (never assume "delivered" merely because the send API
  // call was accepted earlier; that only ever recorded "sent").
  const sendRows = await db
    .select({ id: outreachCampaignSends.id, businessId: outreachCampaignSends.businessId, recipientId: outreachCampaignSends.recipientId })
    .from(outreachCampaignSends)
    .where(eq(outreachCampaignSends.externalMessageId, externalMessageId))
    .limit(1);
  const send = sendRows[0];

  if (send && (event.type === "email.bounced" || event.type === "email.complained")) {
    const recipientEmail = asString(data.to) ?? asStringArray(data.to)[0];
    if (recipientEmail) {
      await addSuppression({
        businessId: send.businessId,
        channel: "email",
        identity: recipientEmail,
        reason: event.type === "email.bounced" ? "bounced" : "complained",
      });
    }
  }

  // Best-effort message status mirror, matching the WhatsApp status-
  // callback convention (messages.status/statusUpdatedAt) — never load-
  // bearing for suppression, which is recorded above regardless.
  await db
    .update(messages)
    .set({ status, statusUpdatedAt: now })
    .where(eq(messages.externalMessageId, externalMessageId));

  console.log(JSON.stringify({ event: "kuba_email_status", timestamp: now.toISOString(), type: event.type, status, hasMatchingSend: Boolean(send) }));

  return NextResponse.json({ received: true });
}

// ---- Inbound email ----

async function handleInboundEmail(event: ResendWebhookEvent) {
  const data = event.data ?? {};
  const providerEventId = asString(data.email_id) ?? asString(data.id);
  const from = asString(data.from);
  const to = asStringArray(data.to);
  const subject = asString(data.subject) ?? "";
  let text = asString(data.text);
  let html = asString(data.html);
  let messageIdHeader = asString(readHeader(data, "Message-ID"));
  const inReplyTo = asString(readHeader(data, "In-Reply-To"));
  const references = asString(readHeader(data, "References"));

  if (!from || to.length === 0) {
    return NextResponse.json({ received: true, ignored: "missing_from_or_to" });
  }

  // Idempotency: a provider event id we've already recorded means this is
  // a webhook retry, not a new message (Phase 14). Scoped globally by the
  // provider's own event id, same convention as the WhatsApp webhook's
  // externalMessageId lookup.
  if (providerEventId) {
    const existing = await db
      .select({ id: messages.id })
      .from(messages)
      .where(eq(messages.externalMessageId, providerEventId))
      .limit(1);
    if (existing[0]) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  }

  const correlation = await correlateInboundEmail({ to, from });

  // Resend's email.received webhook carries routing metadata but the full
  // message body is retrieved separately through the Receiving API.
  // Perform this before tenant writes so a provider failure can be retried
  // without creating a partial customer/conversation/message.
  if (providerEventId && !text && !html) {
    const receivedEmail = await retrieveResendReceivedEmail(providerEventId);
    text = receivedEmail.text;
    html = receivedEmail.html;
    messageIdHeader = messageIdHeader ?? receivedEmail.messageId;
  }

  const sanitized = sanitizeInboundEmailBody({ text, html });
  const now = new Date();

  const metadata = JSON.stringify({
    channel: "email",
    from: normalizeEmailAddress(from),
    to: to.map(normalizeEmailAddress),
    subject,
    messageIdHeader: messageIdHeader ?? null,
    inReplyTo: inReplyTo ?? null,
    references: references ?? null,
    correlation: correlation.classification,
    quotedContentTrimmed: sanitized.quotedContentTrimmed,
    sourceFormat: sanitized.sourceFormat,
  });

  if (correlation.classification === "UNMATCHED_REVIEW_REQUIRED") {
    // No deterministic tenant — never guess. Logged for manual review,
    // nothing persisted under any business.
    console.warn(JSON.stringify({ event: "kuba_email_inbound", timestamp: now.toISOString(), correlation: "UNMATCHED_REVIEW_REQUIRED", to: to.map(normalizeEmailAddress) }));
    return NextResponse.json({ received: true, correlation: "UNMATCHED_REVIEW_REQUIRED" });
  }

  let businessId: string;
  let conversationId: string;
  let integrationId: string;

  if (correlation.classification === "MATCHED_CAMPAIGN" || correlation.classification === "MATCHED_THREAD") {
    businessId = correlation.businessId;
    conversationId = correlation.conversationId;

    const emailIntegration = await getOrLookupEmailIntegration(businessId);
    if (!emailIntegration) {
      console.error("MATCHED_CAMPAIGN/THREAD reply but no email integration row exists for business", { businessId });
      return NextResponse.json({ received: true, error: "no_email_integration" });
    }
    integrationId = emailIntegration.id;

    if (!correlation.conversationExists) {
      const receptionist = await findActiveReceptionist(businessId);
      await db.insert(conversations).values({
        id: conversationId,
        businessId,
        integrationId,
        customerEmail: normalizeEmailAddress(from),
        customerName: normalizeEmailAddress(from),
        assignedEmployeeId: receptionist?.id ?? null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      }).onConflictDoNothing({ target: conversations.id });
    } else {
      await db.update(conversations).set({ updatedAt: now, status: "open" }).where(eq(conversations.id, conversationId));
    }

    if (correlation.classification === "MATCHED_CAMPAIGN") {
      await markRecipientReplied(correlation.businessId, correlation.campaignId, correlation.recipientId);
    }
  } else {
    // MATCHED_CONTACT or NEW_CONVERSATION.
    businessId = correlation.businessId;
    integrationId = correlation.integrationId;

    if (correlation.classification === "MATCHED_CONTACT") {
      conversationId = correlation.conversationId;
      await db.update(conversations).set({ updatedAt: now, status: "open" }).where(eq(conversations.id, conversationId));
    } else {
      const normalizedFrom = normalizeEmailAddress(from);
      const existingCustomer = await db
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.businessId, businessId), eq(customers.email, normalizedFrom)))
        .limit(1);

      let customerId = existingCustomer[0]?.id;
      if (!customerId) {
        customerId = crypto.randomUUID();
        await db.insert(customers).values({
          id: customerId,
          businessId,
          email: normalizedFrom,
          name: normalizedFrom,
          source: "email",
          createdAt: now,
          updatedAt: now,
        });
      }

      const receptionist = await findActiveReceptionist(businessId);
      conversationId = crypto.randomUUID();
      await db.insert(conversations).values({
        id: conversationId,
        businessId,
        integrationId,
        customerId,
        customerEmail: normalizedFrom,
        customerName: normalizedFrom,
        assignedEmployeeId: receptionist?.id ?? null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  await db.insert(messages).values({
    id: crypto.randomUUID(),
    businessId,
    conversationId,
    integrationId,
    externalMessageId: providerEventId ?? null,
    direction: "inbound",
    senderType: "customer",
    content: sanitized.content || "(No readable message content.)",
    messageType: "text",
    metadata,
    createdAt: now,
  });

  // A successfully persisted inbound message is a truthful connection-health
  // signal for this business's own Email integration. Keep the update scoped
  // by both integration and business so a correlated message can never mark
  // another tenant's integration as healthy.
  await db
    .update(integrations)
    .set({ lastWebhookAt: now, updatedAt: now })
    .where(and(eq(integrations.id, integrationId), eq(integrations.businessId, businessId)));

  console.log(JSON.stringify({
    event: "kuba_email_inbound",
    timestamp: now.toISOString(),
    businessId,
    conversationId,
    correlation: correlation.classification,
  }));

  return NextResponse.json({ received: true, correlation: correlation.classification });
}

function readHeader(data: Record<string, unknown>, name: string): string | undefined {
  const headers = data.headers;
  if (Array.isArray(headers)) {
    const match = headers.find((h) => h && typeof h === "object" && "name" in h && (h as { name?: unknown }).name === name);
    const value = match && typeof match === "object" ? (match as { value?: unknown }).value : undefined;
    return typeof value === "string" ? value : undefined;
  }
  if (headers && typeof headers === "object") {
    const value = (headers as Record<string, unknown>)[name];
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

async function getOrLookupEmailIntegration(businessId: string) {
  const rows = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.businessId, businessId), eq(integrations.provider, "email")))
    .limit(1);
  return rows[0] ?? null;
}

async function findActiveReceptionist(businessId: string) {
  const rows = await db
    .select({ id: aiEmployees.id })
    .from(aiEmployees)
    .where(and(eq(aiEmployees.businessId, businessId), eq(aiEmployees.type, "receptionist"), eq(aiEmployees.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}
