import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const employeeId = url.searchParams.get("employeeId") || "";
  const conversationId = url.searchParams.get("conversationId") || "";
  const streamUrl = `${process.env.PUBLIC_APP_URL || url.origin}/api/voice/twilio/stream?employeeId=${encodeURIComponent(employeeId)}&conversationId=${encodeURIComponent(conversationId)}`.replace(/^http/, "ws");
  return new NextResponse(`<Response><Connect><Stream url="${streamUrl}" /></Connect></Response>`, { headers: { "Content-Type": "text/xml" } });
}
