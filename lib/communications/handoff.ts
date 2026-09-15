import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployees, conversationRouting, conversations, handoffs } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isEmployeeImplementationAvailable, isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";
import { isEmployeeEligibleForChannel, type ChannelName } from "./channel-policy";
import type { ConversationDepartment } from "./routing";

/*
 * Server-resolved AI-workforce handoff: the ONE place an AI-initiated
 * conversation reassignment (mastra/tools/request-handoff.ts) or a
 * department-based channel-adapter fallback (Website Chat / WhatsApp, when
 * no team is configured) performs the reassignment. Writes the exact same
 * conversationRouting/conversations/handoffs fields the existing
 * human-triggered flows already write (see app/api/conversations/assign,
 * app/api/workforce/orchestration/route.ts) so every existing reader —
 * the Inbox, the Handoffs page, the employee dashboard's handoff count, the
 * Workforce Orchestration view — picks this up with zero changes.
 *
 * The model never supplies a destination employeeId; it supplies only a
 * semantic intent, and this module resolves it to a real, tenant-scoped,
 * entitled, implemented, channel-eligible, active employee — or fails
 * closed with an honest reason.
 */
export type HandoffIntent = "sales" | "support" | "appointment" | "receptionist";

const INTENT_TO_TYPE: Record<HandoffIntent, string> = {
  sales: "sales",
  support: "customer-support",
  appointment: "appointment",
  receptionist: "receptionist",
};

const INTENT_TO_DEPARTMENT: Record<HandoffIntent, ConversationDepartment> = {
  sales: "sales",
  support: "customer_support",
  appointment: "reception",
  receptionist: "reception",
};

/**
 * Customer-facing conversation department -> the intent to try first when no
 * team/aiEmployeeTeams routing has resolved a specific employee. Finance and
 * Marketing departments never resolve directly to the internal Finance/
 * Accountant/Marketing employees (they are internal-only by channel policy);
 * a customer-facing billing or promotion question is handled by Support or
 * Sales instead, who can escalate internally via their own task tools.
 */
const DEPARTMENT_TO_INTENT: Record<ConversationDepartment, HandoffIntent> = {
  sales: "sales",
  reception: "receptionist",
  customer_support: "support",
  product: "sales",
  finance: "support",
  operations: "receptionist",
  marketing: "sales",
  management: "receptionist",
};

export type HandoffResolution =
  | { ok: true; employee: { id: string; name: string; type: string } }
  | { ok: false; reason: string };

/** Dimension check only — does NOT mutate anything. Safe to call speculatively. */
export async function resolveEmployeeForHandoff({
  businessId,
  intent,
  channel,
}: {
  businessId: string;
  intent: HandoffIntent;
  channel: ChannelName;
}): Promise<HandoffResolution> {
  const type = INTENT_TO_TYPE[intent];

  const rows = await db
    .select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status })
    .from(aiEmployees)
    .where(and(eq(aiEmployees.businessId, businessId), eq(aiEmployees.type, type), eq(aiEmployees.status, "active")))
    .limit(1);

  const employee = rows[0];
  if (!employee) {
    return { ok: false, reason: `No active ${type} employee is available for this business.` };
  }

  const entitlements = await getBusinessEntitlements(businessId);
  if (!isEmployeeTypeEntitled(entitlements, type)) {
    return { ok: false, reason: `${type} is no longer entitled on the current plan.` };
  }
  if (!isEmployeeImplementationAvailable(type)) {
    return { ok: false, reason: `${type} has no runtime available.` };
  }
  if (!(await isEmployeeEligibleForChannel(businessId, employee, channel))) {
    return { ok: false, reason: `${type} is not eligible for the ${channel} channel.` };
  }

  return { ok: true, employee: { id: employee.id, name: employee.name, type: employee.type } };
}

/** Same resolution, tried against the department-mapped intent, for channel-adapter fallback use (never the AI-tool path, which always supplies an explicit intent). */
export async function resolveEmployeeForDepartment(params: {
  businessId: string;
  department: ConversationDepartment;
  channel: ChannelName;
}): Promise<HandoffResolution> {
  const intent = DEPARTMENT_TO_INTENT[params.department] ?? "receptionist";
  return resolveEmployeeForHandoff({ businessId: params.businessId, intent, channel: params.channel });
}

type AiHandoffOutcome =
  | { success: true; employee: { id: string; name: string; type: string } }
  | { success: false; error: string };

type HumanEscalationOutcome = { success: true } | { success: false; error: string };

/**
 * Reassigns a live conversation to another AI employee. Verifies the
 * conversation genuinely belongs to businessId before touching anything —
 * a handoff can never reach across tenants, even if a stale/forged
 * conversationId were ever supplied.
 */
export async function performAiHandoff({
  businessId,
  conversationId,
  fromEmployeeId,
  intent,
  channel,
  reason,
}: {
  businessId: string;
  conversationId: string;
  fromEmployeeId: string | null;
  intent: HandoffIntent;
  channel: ChannelName;
  reason: string;
}): Promise<AiHandoffOutcome> {
  const conversationRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)))
    .limit(1);

  if (!conversationRows[0]) {
    return { success: false, error: "Conversation not found for this business." };
  }

  const resolution = await resolveEmployeeForHandoff({ businessId, intent, channel });
  if (!resolution.ok) {
    return { success: false, error: resolution.reason };
  }

  const now = new Date();
  const routingRows = await db
    .select({ id: conversationRouting.id })
    .from(conversationRouting)
    .where(eq(conversationRouting.conversationId, conversationId))
    .limit(1);

  if (routingRows[0]) {
    await db
      .update(conversationRouting)
      .set({
        aiEmployeeId: resolution.employee.id,
        assignedUserId: null,
        assignmentType: "ai",
        status: "ai_handling",
        routingReason: reason,
        updatedAt: now,
      })
      .where(eq(conversationRouting.id, routingRows[0].id));
  } else {
    await db.insert(conversationRouting).values({
      id: crypto.randomUUID(),
      businessId,
      conversationId,
      department: INTENT_TO_DEPARTMENT[intent],
      teamId: null,
      aiEmployeeId: resolution.employee.id,
      assignedUserId: null,
      assignmentType: "ai",
      status: "ai_handling",
      priority: "normal",
      confidence: 100,
      routingReason: reason,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(conversations)
    .set({ assignedEmployeeId: resolution.employee.id, aiMode: "active", updatedAt: now })
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)));

  await db.insert(handoffs).values({
    id: crypto.randomUUID(),
    businessId,
    conversationId,
    fromEmployeeId: fromEmployeeId ?? null,
    toUserId: null,
    reason,
    status: "completed",
    createdAt: now,
    updatedAt: now,
  });

  await createAuditLog({
    businessId,
    userId: null,
    action: "ai.handoff.to_ai",
    resource: "conversation",
    resourceId: conversationId,
    description: `AI handoff to ${resolution.employee.type}: ${reason}`,
    metadata: { fromEmployeeId, toEmployeeId: resolution.employee.id, toType: resolution.employee.type, intent },
  });

  return { success: true, employee: resolution.employee };
}

/**
 * Escalates a live conversation to a human queue — never a specific,
 * model-chosen person. Sets the same waiting_for_human/pending state the
 * existing Inbox (`needsHuman`) and Handoffs page already read; a real
 * staff member then claims it via the existing
 * app/api/conversations/takeover or assign-human routes.
 */
export async function performHumanEscalation({
  businessId,
  conversationId,
  fromEmployeeId,
  reason,
}: {
  businessId: string;
  conversationId: string;
  fromEmployeeId: string | null;
  reason: string;
}): Promise<HumanEscalationOutcome> {
  const conversationRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)))
    .limit(1);

  if (!conversationRows[0]) {
    return { success: false, error: "Conversation not found for this business." };
  }

  const now = new Date();
  const routingRows = await db
    .select({ id: conversationRouting.id })
    .from(conversationRouting)
    .where(eq(conversationRouting.conversationId, conversationId))
    .limit(1);

  if (routingRows[0]) {
    await db
      .update(conversationRouting)
      .set({
        aiEmployeeId: null,
        assignedUserId: null,
        assignmentType: "team",
        status: "waiting_for_human",
        priority: "high",
        routingReason: reason,
        updatedAt: now,
      })
      .where(eq(conversationRouting.id, routingRows[0].id));
  } else {
    await db.insert(conversationRouting).values({
      id: crypto.randomUUID(),
      businessId,
      conversationId,
      department: "reception",
      teamId: null,
      aiEmployeeId: null,
      assignedUserId: null,
      assignmentType: "team",
      status: "waiting_for_human",
      priority: "high",
      confidence: 100,
      routingReason: reason,
      createdAt: now,
      updatedAt: now,
    });
  }

  await db
    .update(conversations)
    .set({ assignedEmployeeId: null, aiMode: "paused", updatedAt: now })
    .where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId)));

  await db.insert(handoffs).values({
    id: crypto.randomUUID(),
    businessId,
    conversationId,
    fromEmployeeId: fromEmployeeId ?? null,
    toUserId: null,
    reason,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });

  await createAuditLog({
    businessId,
    userId: null,
    action: "ai.handoff.to_human",
    resource: "conversation",
    resourceId: conversationId,
    description: `AI escalated to a human: ${reason}`,
    metadata: { fromEmployeeId, reason },
  });

  return { success: true };
}
