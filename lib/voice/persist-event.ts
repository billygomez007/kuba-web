import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployeeActivities, conversations, customers, messages } from "@/db/schema";
import { updateVoiceSession } from "@/lib/voice/session-manager";
import { roundBillableMinutes } from "@/lib/billing/usage";

export interface VoiceEvent {
  type: string;
  provider?: string;
  providerCallId: string;
  phoneNumber: string;
  direction: string;
  transcript?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  failureCategory?: string;
}

/**
 * The single canonical place a voice call event becomes a
 * conversation/message/activity row — used by both
 * app/api/voice/calls/route.ts's inbound-webhook/outbound-initiation
 * branches AND app/api/internal/voice/call-events/route.ts (the Voice
 * Gateway's reporting endpoint), so there is exactly one persistence
 * path regardless of which surface reports the event. Extracted
 * unchanged from its original home in the calls route.
 */
export async function persistEvent(businessId: string, employeeId: string, event: VoiceEvent) {
  const now = new Date();
  const customer = (await db.select({ id: customers.id }).from(customers).where(and(eq(customers.businessId, businessId), eq(customers.phone, event.phoneNumber))).limit(1))[0];
  const existing = (await db.select({ id: conversations.id }).from(conversations).where(and(eq(conversations.businessId, businessId), eq(conversations.externalConversationId, event.providerCallId))).limit(1))[0];
  const conversationId = existing?.id || crypto.randomUUID();
  const eventKey = `${event.providerCallId}:${event.type}`;
  const alreadyRecorded = existing && (await db.select({ id: messages.id }).from(messages).where(and(eq(messages.conversationId, conversationId), eq(messages.externalMessageId, eventKey))).limit(1))[0];
  if (alreadyRecorded) return conversationId;
  const lifecycleStatus = event.type === "call.failed" ? "failed" : event.type === "call.completed" ? "closed" : event.type === "call.escalated" ? "escalated" : event.type === "call.connected" ? "open" : undefined;
  const lifecycleFields = {
    assignedEmployeeId: employeeId,
    ...(lifecycleStatus ? { status: lifecycleStatus } : {}),
    voiceProvider: event.provider || "plivo",
    voiceDirection: event.direction,
    ...(event.type === "call.started" || event.type === "call.ringing" ? { voiceStartedAt: now } : {}),
    ...(event.type === "call.connected" ? { voiceConnectedAt: now } : {}),
    ...(event.type === "call.completed" || event.type === "call.failed" ? { voiceEndedAt: now } : {}),
    ...(event.durationSeconds !== undefined ? { voiceDurationSeconds: event.durationSeconds, voiceBillableMinutes: roundBillableMinutes(event.durationSeconds) } : {}),
    ...(event.recordingUrl ? { voiceRecordingUrl: event.recordingUrl } : {}),
    updatedAt: now,
  };
  if (!existing) await db.insert(conversations).values({ id: conversationId, businessId, customerId: customer?.id || null, integrationId: "voice-runtime", externalConversationId: event.providerCallId, customerPhone: event.phoneNumber, ...lifecycleFields, aiMode: event.type === "call.failed" || event.type === "call.completed" ? "inactive" : "active", status: lifecycleStatus || "open", createdAt: now });
  else await db.update(conversations).set(lifecycleFields).where(eq(conversations.id, conversationId));
  const content = event.transcript || `${event.type} (${event.direction})${event.durationSeconds ? `, ${event.durationSeconds}s` : ""}${event.recordingUrl ? `, recording: ${event.recordingUrl}` : ""}`;
  // Idempotency (Phase 37): a provider webhook can be redelivered for the
  // exact same lifecycle event (e.g. the same "call.completed" hangup
  // fired twice) — that must never insert a second message row. Distinct
  // FROM providerCallId alone, since every event for the same call
  // (ringing, then completed) legitimately shares one providerCallId;
  // only a duplicate of the SAME event type for the SAME call is a dup.
  // failureCategory is a safe, fixed-vocabulary classification only
  // (lib/voice/failure-classification.ts) — never the raw provider
  // response (Phase 28/38), stored in the same generic metadata JSON
  // column email inbound messages already use rather than a new column.
  const metadata = event.failureCategory ? JSON.stringify({ channel: "voice", failureCategory: event.failureCategory }) : null;
  await db.insert(messages).values({ id: crypto.randomUUID(), businessId, conversationId, integrationId: "voice-runtime", externalMessageId: eventKey, direction: event.direction === "inbound" ? "inbound" : "outbound", senderType: "voice", senderId: employeeId, content, messageType: "voice", metadata, createdAt: now });
  await db.insert(aiEmployeeActivities).values({ id: crypto.randomUUID(), businessId, employeeId, type: `voice_${event.type}`, title: `Voice ${event.type.replace(".", " ")}`, description: content, status: event.type === "call.escalated" ? "escalated" : "completed", createdAt: now });
  const sessionState: "completed" | "failed" | "active" | "ringing" = event.type === "call.completed" ? "completed" : event.type === "call.failed" ? "failed" : event.type === "call.connected" ? "active" : "ringing";
  await updateVoiceSession(conversationId, businessId, sessionState);
  return conversationId;
}
