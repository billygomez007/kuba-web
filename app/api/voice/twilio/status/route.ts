import { NextResponse } from "next/server";

import { verifyTwilioSignature } from "@/lib/voice/twilio-signature";

export async function POST(request: Request) {
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    params[key] = String(value);
  }

  const callbackUrl = `${process.env.PUBLIC_APP_URL || new URL(request.url).origin}/api/voice/twilio/status`;
  const signature = request.headers.get("x-twilio-signature");

  if (!verifyTwilioSignature(callbackUrl, params, signature)) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  }

  const status = String(form.get("CallStatus") || "");
  const event = status === "completed" ? "call.completed" : status === "failed" ? "call.failed" : status === "ringing" ? "call.ringing" : "call.started";
  const secret = process.env.VOICE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook secret is not configured." }, { status: 503 });
  const response = await fetch(`${new URL(request.url).origin}/api/voice/calls`, { method: "POST", headers: { "Content-Type": "application/json", "x-voice-webhook-secret": secret }, body: JSON.stringify({ provider: "twilio", businessId: String(form.get("BusinessId") || ""), employeeId: String(form.get("EmployeeId") || ""), event: { type: event, providerCallId: String(form.get("CallSid") || ""), phoneNumber: String(form.get("From") || ""), direction: "inbound" } }) });
  return NextResponse.json({ received: response.ok });
}
