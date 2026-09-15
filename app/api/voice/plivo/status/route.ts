import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { conversations } from "@/db/schema";
import { verifyPlivoSignature } from "@/lib/voice/plivo-signature";
import { resolveVoiceIntegrationByPhoneNumber } from "@/lib/voice/tenant";
import { classifyPlivoHangup } from "@/lib/voice/failure-classification";

/**
 * Canonical Plivo call-end (hangup_url) webhook (Phase 18-19). Same
 * tenant-resolution rule as the answer webhook — never trust businessId/
 * employeeId supplied by the request; recover them from either the
 * conversation we created (SuperKuba-initiated call) or the dialed
 * number's own registration (cold inbound call).
 *
 * Idempotent by construction: forwards to /api/voice/calls, whose
 * persistEvent looks up the existing conversation by
 * externalConversationId (the real CallUUID, reconciled by the answer
 * webhook) before deciding whether to insert or update — a duplicate
 * hangup delivery updates the same row rather than creating a second one.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) params[key] = String(value);

  const callbackUrl = `${process.env.PUBLIC_APP_URL || url.origin}${url.pathname}${url.search}`;
  const nonce = request.headers.get("x-plivo-signature-v2-nonce");
  const signature = request.headers.get("x-plivo-signature-v2");
  if (!verifyPlivoSignature(callbackUrl, nonce, signature)) {
    return NextResponse.json({ error: "Invalid Plivo signature." }, { status: 403 });
  }

  const employeeIdParam = url.searchParams.get("employeeId") || "";
  const conversationIdParam = url.searchParams.get("conversationId") || "";
  const toNumber = params.To || "";
  const fromNumber = params.From || "";
  const callUuid = params.CallUUID || "";
  const durationSeconds = Number.parseInt(params.Duration || "0", 10) || 0;

  let businessId: string | null = null;
  let employeeId: string | null = null;

  if (employeeIdParam && conversationIdParam) {
    const existing = (await db.select({ businessId: conversations.businessId }).from(conversations).where(eq(conversations.id, conversationIdParam)).limit(1))[0];
    if (existing) {
      businessId = existing.businessId;
      employeeId = employeeIdParam;
    }
  } else if (toNumber) {
    const resolved = await resolveVoiceIntegrationByPhoneNumber("plivo", toNumber);
    if (resolved) {
      businessId = resolved.businessId;
      employeeId = resolved.employeeId;
    }
  }

  if (!businessId || !employeeId) {
    console.warn(JSON.stringify({ event: "kuba_voice_plivo_status_unmatched", timestamp: new Date().toISOString(), callUuid }));
    return NextResponse.json({ received: true, unmatched: true });
  }

  const direction = employeeIdParam ? "outbound" : "inbound";
  const customerPhoneNumber = direction === "outbound" ? toNumber : fromNumber;
  const outcome = classifyPlivoHangup(params.HangupCauseName, durationSeconds);

  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 503 });

  const response = await fetch(`${url.origin}/api/voice/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-voice-webhook-secret": secret },
    body: JSON.stringify({
      provider: "plivo",
      businessId,
      employeeId,
      event: {
        type: outcome.completed ? "call.completed" : "call.failed",
        providerCallId: callUuid || conversationIdParam,
        phoneNumber: customerPhoneNumber,
        direction,
        durationSeconds,
        ...(outcome.completed ? {} : { failureCategory: outcome.failureCategory }),
      },
    }),
  });
  return NextResponse.json({ received: response.ok });
}
