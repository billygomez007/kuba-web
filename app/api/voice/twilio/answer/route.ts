import { NextResponse } from "next/server";
import { verifyTwilioSignature } from "@/lib/voice/twilio-signature";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const form = await request.formData();
  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) params[key] = String(value);
  const callbackUrl = `${process.env.PUBLIC_APP_URL || url.origin}${url.pathname}${url.search}`;
  if (!verifyTwilioSignature(callbackUrl, params, request.headers.get("x-twilio-signature"))) {
    return NextResponse.json({ error: "Invalid Twilio signature." }, { status: 403 });
  }
  const employeeId = url.searchParams.get("employeeId") || "";
  const conversationId = url.searchParams.get("conversationId") || "";
  const streamUrl = `${process.env.PUBLIC_APP_URL || url.origin}/api/voice/twilio/stream?employeeId=${encodeURIComponent(employeeId)}&conversationId=${encodeURIComponent(conversationId)}`.replace(/^http/, "ws");
  return new NextResponse(`<Response><Connect><Stream url="${streamUrl}" /></Connect></Response>`, { headers: { "Content-Type": "text/xml" } });
}
