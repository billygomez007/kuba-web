import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { conversations, messages } from "@/db/schema";

export type VoiceSessionState = "ringing" | "connecting" | "active" | "waiting" | "transferred" | "completed" | "failed";

export async function updateVoiceSession(conversationId: string, businessId: string, state: VoiceSessionState) {
  const status = state === "transferred" ? "escalated" : state === "completed" ? "resolved" : "open";
  const now = new Date();
  const values = { status, aiMode: state === "transferred" || state === "completed" ? "paused" : "active", updatedAt: now, ...(state === "ringing" ? { voiceStartedAt: now } : {}), ...(state === "active" ? { voiceConnectedAt: now } : {}), ...(state === "completed" || state === "failed" ? { voiceEndedAt: now } : {}) };
  await db.update(conversations).set(values).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId), eq(conversations.integrationId, "voice-runtime")));
  if (state === "completed" || state === "failed") {
    const row = (await db.select({ startedAt: conversations.voiceConnectedAt, endedAt: conversations.voiceEndedAt }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId))).limit(1))[0];
    if (row?.startedAt) await db.update(conversations).set({ voiceDurationSeconds: Math.max(0, Math.round(((row.endedAt || now).getTime() - row.startedAt.getTime()) / 1000)) }).where(eq(conversations.id, conversationId));
  }
  return { conversationId, state };
}

export async function appendVoiceTranscript({ conversationId, businessId, employeeId, direction, text }: { conversationId: string; businessId: string; employeeId: string; direction: "inbound" | "outbound"; text: string }) {
  const value = text.trim();
  if (!value) return;
  await db.insert(messages).values({ id: crypto.randomUUID(), businessId, conversationId, integrationId: "voice-runtime", externalMessageId: null, direction, senderType: direction === "inbound" ? "customer" : "ai_employee", senderId: direction === "inbound" ? null : employeeId, content: value, messageType: "voice", createdAt: new Date() });
  await db.update(conversations).set({ updatedAt: new Date() }).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId), eq(conversations.integrationId, "voice-runtime")));
}

export async function retryVoiceOperation<T>(operation: () => Promise<T>, attempts = 3) {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Voice operation failed.");
}