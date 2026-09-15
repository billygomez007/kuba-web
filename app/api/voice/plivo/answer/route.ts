import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { conversations } from "@/db/schema";
import { verifyPlivoSignature } from "@/lib/voice/plivo-signature";
import { resolveVoiceIntegrationByPhoneNumber } from "@/lib/voice/tenant";
import { buildAnswerResponse, buildUnavailableResponse } from "@/lib/voice/plivo-xml";
import { createVoiceSessionToken } from "@/lib/voice/gateway-session";

/**
 * Canonical Plivo inbound-call answer webhook (Phase 8-10). Tenant is
 * NEVER read from the request payload — either:
 *  (a) employeeId/conversationId query params are present, meaning
 *      SuperKuba itself placed this call (see
 *      lib/voice/adapters/plivo.ts's startCall, which embeds them in a
 *      URL Plivo's signature covers) — businessId is then recovered
 *      from the conversation row WE already created under an
 *      authenticated, entitlement-checked request, never from anything
 *      Plivo or the caller supplied; or
 *  (b) neither is present (a genuine cold inbound call) — businessId is
 *      resolved exclusively from the dialed number's own registration
 *      (resolveVoiceIntegrationByPhoneNumber), mirroring
 *      lib/channels/whatsapp.ts's resolveWhatsAppIntegrationByPhoneNumberId.
 *
 * An invalid signature is rejected (403) before any business data is
 * touched, matching Phase 9's requirement exactly.
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

  let businessId: string | null = null;
  let employeeId: string | null = null;

  if (employeeIdParam && conversationIdParam) {
    // SuperKuba-initiated (outbound) call — recover businessId from the
    // conversation row created at call-initiation time, not from the URL.
    const existing = (await db.select({ businessId: conversations.businessId }).from(conversations).where(eq(conversations.id, conversationIdParam)).limit(1))[0];
    if (existing) {
      businessId = existing.businessId;
      employeeId = employeeIdParam;
      // Reconcile the placeholder external id to Plivo's real CallUUID
      // now that we have it (see lib/voice/adapters/plivo.ts's comment
      // on request_uuid vs. CallUUID) — without this, the later status
      // webhook's conversation lookup by CallUUID would never match and
      // would create a second, orphaned conversation.
      if (callUuid) {
        await db.update(conversations).set({ externalConversationId: callUuid, updatedAt: new Date() }).where(eq(conversations.id, conversationIdParam));
      }
    }
  } else if (toNumber) {
    const resolved = await resolveVoiceIntegrationByPhoneNumber("plivo", toNumber);
    if (resolved) {
      businessId = resolved.businessId;
      employeeId = resolved.employeeId;
    }
  }

  if (!businessId || !employeeId) {
    // No deterministic tenant — never guess, never touch business data.
    console.warn(JSON.stringify({ event: "kuba_voice_plivo_unmatched", timestamp: new Date().toISOString(), to: toNumber || null }));
    return new NextResponse(buildUnavailableResponse("This number is not yet configured to receive calls."), { headers: { "Content-Type": "text/xml" } });
  }

  const direction = employeeIdParam ? "outbound" : "inbound";
  const customerPhoneNumber = direction === "outbound" ? toNumber : fromNumber;

  // Awaited (not fire-and-forget) specifically to capture the real
  // conversations.id persistEvent resolves/creates — needed so the
  // session token can carry it for voice tools that act on the live
  // conversation (e.g. request_handoff). A failure here is non-fatal:
  // the call still proceeds, just without a conversationId in its token
  // (those specific voice tools become honestly unavailable for it).
  let resolvedConversationId = conversationIdParam || undefined;
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (secret) {
    try {
      const eventResponse = await fetch(`${url.origin}/api/voice/calls`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-voice-webhook-secret": secret },
        body: JSON.stringify({
          provider: "plivo",
          businessId,
          employeeId,
          event: { type: "call.ringing", providerCallId: callUuid || conversationIdParam, phoneNumber: customerPhoneNumber, direction },
        }),
      });
      const eventBody = await eventResponse.json().catch(() => null);
      if (typeof eventBody?.conversationId === "string") {
        resolvedConversationId = eventBody.conversationId;
      }
    } catch (error) {
      console.error("Plivo answer -> voice event forwarding failed:", error);
    }
  }

  // The Voice Gateway session token carries only an opaque sessionId +
  // businessId/employeeId already resolved above server-side — never
  // built from anything Plivo or the caller supplied. callUuid may still
  // be empty on a genuinely fresh cold-call answer hit before Plivo has
  // assigned one; conversationIdParam is always present for an
  // outbound-initiated call, so the session id is never empty either way.
  const sessionToken = createVoiceSessionToken({
    sessionId: callUuid || conversationIdParam || crypto.randomUUID(),
    businessId,
    employeeId,
    provider: "plivo",
    direction,
    conversationId: resolvedConversationId,
  });

  return new NextResponse(buildAnswerResponse(sessionToken, customerPhoneNumber || undefined), { headers: { "Content-Type": "text/xml" } });
}
