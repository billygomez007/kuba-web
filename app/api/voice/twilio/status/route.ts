import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { conversations } from "@/db/schema";
import { verifyTwilioSignature } from "@/lib/voice/twilio-signature";
import { resolveVoiceIntegrationByPhoneNumber } from "@/lib/voice/tenant";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  const callbackUrl = `${process.env.PUBLIC_APP_URL || url.origin}/api/voice/twilio/status`;
  const signature = request.headers.get("x-twilio-signature");

  if (!verifyTwilioSignature(callbackUrl, params, signature)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  }

  // Tenant is NEVER read from request fields Twilio doesn't actually
  // send (this route previously read form.get("BusinessId")/"EmployeeId",
  // which Twilio never populates without explicit custom-parameter
  // configuration this codebase never sets — a real, pre-existing gap
  // fixed here using the same resolver Plivo's equivalent route uses):
  // recover businessId/employeeId from the conversation this app itself
  // created (embedded conversationId in the answer URL, for calls
  // SuperKuba initiated) or from the dialed number's own registration
  // (for a cold inbound call).
  const employeeIdParam = url.searchParams.get("employeeId") || "";
  const conversationIdParam = url.searchParams.get("conversationId") || "";
  const toNumber = String(form.get("To") || "");
  const fromNumber = String(form.get("From") || "");

  let businessId: string | null = null;
  let employeeId: string | null = null;
  if (employeeIdParam && conversationIdParam) {
    const existing = (await db.select({ businessId: conversations.businessId }).from(conversations).where(eq(conversations.id, conversationIdParam)).limit(1))[0];
    if (existing) {
      businessId = existing.businessId;
      employeeId = employeeIdParam;
    }
  } else if (toNumber) {
    const resolved = await resolveVoiceIntegrationByPhoneNumber("twilio", toNumber);
    if (resolved) {
      businessId = resolved.businessId;
      employeeId = resolved.employeeId;
    }
  }
  if (!businessId || !employeeId) {
    console.warn(JSON.stringify({ event: "kuba_voice_twilio_status_unmatched", timestamp: new Date().toISOString() }));
    return NextResponse.json({ received: true, unmatched: true });
  }

  const direction = employeeIdParam ? "outbound" : "inbound";
  const status = String(form.get("CallStatus") || "");
  const event = status === "completed" ? "call.completed" : status === "failed" ? "call.failed" : status === "ringing" ? "call.ringing" : "call.started";
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 503 });
  const response = await fetch(`${url.origin}/api/voice/calls`, { method: "POST", headers: { "Content-Type": "application/json", "x-voice-webhook-secret": secret }, body: JSON.stringify({ provider: "twilio", businessId, employeeId, event: { type: event, providerCallId: String(form.get("CallSid") || ""), phoneNumber: direction === "outbound" ? toNumber : fromNumber, direction } }) });
  return NextResponse.json({ received: response.ok });
}
