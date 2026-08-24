import { and, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { aiEmployees, automations, automationRuns, conversations, integrations, knowledgeSources, messages, subscriptions } from "@/db/schema";
import type { PlanDefinition } from "./entitlements";

export type UsageMetric = { used: number | null; limit: number | null; state: "within_limit" | "near_limit" | "limit_reached" | "overage_ready" | "not_tracked" };
export function roundBillableMinutes(seconds: number) { return seconds <= 0 ? 0 : Math.ceil(seconds / 60); }
export function usageState(used: number | null, limit: number | null): UsageMetric["state"] { if (used === null) return "not_tracked"; if (limit === null) return "within_limit"; if (used > limit) return "overage_ready"; if (used >= limit) return "limit_reached"; if (used >= limit * 0.85) return "near_limit"; return "within_limit"; }
export function usageMetric(used: number | null, limit: number | null): UsageMetric { return { used, limit, state: usageState(used, limit) }; }

export async function getUsagePeriod(businessId: string) {
  const subscription = (await db.select({ currentPeriodStart: subscriptions.currentPeriodStart, currentPeriodEnd: subscriptions.currentPeriodEnd }).from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1))[0];
  if (subscription?.currentPeriodStart && subscription.currentPeriodEnd) return { start: subscription.currentPeriodStart, end: subscription.currentPeriodEnd, source: "subscription" as const };
  const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth(), 1); const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end, source: "calendar_month_fallback" as const };
}

export async function getBusinessUsage(businessId: string, plan: PlanDefinition) {
  const period = await getUsagePeriod(businessId);
  const [employees, conversationsData, messagesData, automationsData, runs, voiceCalls, sources, connections] = await Promise.all([
    db.select({ id: aiEmployees.id, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
    db.select({ id: conversations.id, integrationId: conversations.integrationId, assignedEmployeeId: conversations.assignedEmployeeId }).from(conversations).where(and(eq(conversations.businessId, businessId), gte(conversations.createdAt, period.start), lt(conversations.createdAt, period.end))),
    db.select({ id: messages.id, integrationId: messages.integrationId, direction: messages.direction, senderType: messages.senderType }).from(messages).where(and(eq(messages.businessId, businessId), gte(messages.createdAt, period.start), lt(messages.createdAt, period.end))),
    db.select({ id: automations.id }).from(automations).where(eq(automations.businessId, businessId)),
    db.select({ id: automationRuns.id, status: automationRuns.status }).from(automationRuns).where(and(eq(automationRuns.businessId, businessId), gte(automationRuns.startedAt, period.start), lt(automationRuns.startedAt, period.end))),
    db.select({ durationSeconds: conversations.voiceDurationSeconds, billableMinutes: conversations.voiceBillableMinutes, direction: conversations.voiceDirection }).from(conversations).where(and(eq(conversations.businessId, businessId), eq(conversations.integrationId, "voice-runtime"), gte(conversations.createdAt, period.start), lt(conversations.createdAt, period.end))),
    db.select({ id: knowledgeSources.id }).from(knowledgeSources).where(eq(knowledgeSources.businessId, businessId)),
    db.select({ id: integrations.id }).from(integrations).where(eq(integrations.businessId, businessId)),
  ]);
  const voiceMinutes = voiceCalls.reduce<number | null>((total, call) => call.billableMinutes !== null ? (total || 0) + call.billableMinutes : call.durationSeconds !== null ? (total || 0) + roundBillableMinutes(call.durationSeconds) : total, null);
  const byChannel = new Map<string, { inbound: number; outbound: number; total: number }>();
  for (const message of messagesData) { if (message.senderType === "system") continue; const channel = message.integrationId === "voice-runtime" ? "voice" : message.integrationId; const item = byChannel.get(channel) || { inbound: 0, outbound: 0, total: 0 }; item[message.direction === "inbound" ? "inbound" : "outbound"] += 1; item.total += 1; byChannel.set(channel, item); }
  return { period: { start: period.start.toISOString(), end: period.end.toISOString(), source: period.source }, employees: usageMetric(employees.filter((item) => item.status === "active").length, plan.employeeLimit), conversations: usageMetric(conversationsData.length, null), messages: usageMetric(messagesData.filter((item) => item.senderType !== "system").length, null), messagesByChannel: Object.fromEntries(byChannel), automations: usageMetric(automationsData.length, plan.automationLimit), automationRuns: usageMetric(runs.length, null), automationRunsSuccessful: runs.filter((item) => item.status === "completed").length, automationRunsFailed: runs.filter((item) => item.status === "failed").length, voiceMinutes: usageMetric(voiceMinutes, plan.includedVoiceMinutes || null), voiceCalls: usageMetric(voiceCalls.length, null), knowledgeSources: usageMetric(sources.length, null), integrations: usageMetric(connections.length, null), modelTokens: usageMetric(null, null) };
}
