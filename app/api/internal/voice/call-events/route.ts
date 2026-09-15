import { NextResponse } from "next/server";

import { requireGatewayInternalAuth } from "@/lib/voice/internal-auth";
import { getActiveEmployee } from "@/lib/voice/employee-lookup";
import { persistEvent, type VoiceEvent } from "@/lib/voice/persist-event";

/**
 * Internal-only (Phase 7): the Voice Gateway reports call lifecycle
 * events here (connected, tool-call summary counts, ended, failed) —
 * businessId/employeeId always come from the verified session token,
 * never the request body. Delegates to the exact same persistEvent used
 * by the Plivo/Twilio webhook routes (lib/voice/persist-event.ts), so
 * there is one persistence path and one idempotency mechanism
 * regardless of which surface reports an event.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const auth = requireGatewayInternalAuth(request, body.token);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { businessId, employeeId } = auth.claims;
  const employee = await getActiveEmployee(businessId, employeeId);
  if (!employee) return NextResponse.json({ error: "Employee not found or inactive." }, { status: 404 });

  const event = body.event;
  if (!event || typeof event !== "object" || typeof event.type !== "string" || typeof event.providerCallId !== "string" || typeof event.phoneNumber !== "string" || typeof event.direction !== "string") {
    return NextResponse.json({ error: "Invalid call event." }, { status: 400 });
  }

  const voiceEvent: VoiceEvent = {
    type: event.type,
    providerCallId: event.providerCallId,
    phoneNumber: event.phoneNumber,
    direction: event.direction,
    durationSeconds: typeof event.durationSeconds === "number" ? event.durationSeconds : undefined,
    failureCategory: typeof event.failureCategory === "string" ? event.failureCategory : undefined,
    // A transcript segment, if OpenAI Realtime's transcription events are
    // reliable enough to forward (Phase 27) — the gateway decides that,
    // never logs it itself, and this is the one place it gets persisted.
    transcript: typeof event.transcript === "string" ? event.transcript.slice(0, 4000) : undefined,
  };

  const conversationId = await persistEvent(businessId, employeeId, voiceEvent);
  return NextResponse.json({ success: true, conversationId });
}
