import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireBusinessId } from "@/mastra/tools/business-context";
import { TICKET_PRIORITIES, validateReferences } from "@/lib/customer-operations";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

async function requireAiAssist(businessId: string) {
  const entitlements = await getBusinessEntitlements(businessId);
  if (!hasCapability(entitlements, "customer_ops.ai_assist")) {
    throw new Error("AI-assisted support tickets require the Pro plan or higher.");
  }
}

export const getTicketsTool = createTool({
  id: "get-support-tickets",
  description: "Retrieve support tickets belonging to the current business.",
  inputSchema: z.object({ status: z.string().optional(), customerId: z.string().optional(), ticketId: z.string().optional() }),
  execute: async ({ status, customerId, ticketId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    await requireAiAssist(businessId);
    const conditions = [eq(tickets.businessId, businessId)];
    if (status) conditions.push(eq(tickets.status, status)); if (customerId) conditions.push(eq(tickets.customerId, customerId)); if (ticketId) conditions.push(eq(tickets.id, ticketId));
    return { tickets: await db.select().from(tickets).where(and(...conditions)).orderBy(desc(tickets.updatedAt)).limit(50) };
  },
});

export const createSupportTicketTool = createTool({
  id: "create-support-ticket",
  description: "Create a support ticket for the current business. Creation does not resolve or close the ticket.",
  inputSchema: z.object({ subject: z.string(), description: z.string(), priority: z.enum(["low", "normal", "high", "urgent"]).optional(), customerId: z.string().optional(), leadId: z.string().optional(), conversationId: z.string().optional(), branchId: z.string().optional() }),
  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    await requireAiAssist(businessId);
    const priority = input.priority || "normal";
    if (!TICKET_PRIORITIES.includes(priority)) throw new Error("Priority is invalid.");
    const refs = { customerId: input.customerId || null, leadId: input.leadId || null, conversationId: input.conversationId || null, branchId: input.branchId || null, assignedUserId: null, assignedHumanEmployeeId: null, assignedAiEmployeeId: null, assignedTeamId: null };
    await validateReferences(businessId, refs);
    const id = crypto.randomUUID(); const now = new Date();
    await db.insert(tickets).values({ id, businessId, ticketReference: `SUP-${id.slice(0, 8).toUpperCase()}`, subject: input.subject.trim(), description: input.description.trim(), ...refs, status: "open", priority, source: "ai", category: null, resolutionSummary: null, openedAt: now, firstResponseAt: null, resolvedAt: null, closedAt: null, createdBy: "ai-customer-support", createdAt: now, updatedAt: now });
    return { success: true, ticketId: id };
  },
});

export const requestTicketEscalationTool = createTool({
  id: "request-ticket-escalation",
  description: "Request human attention for an existing support ticket. This tool cannot resolve, close, or reopen tickets.",
  inputSchema: z.object({ ticketId: z.string(), reason: z.string() }),
  execute: async ({ ticketId, reason }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    await requireAiAssist(businessId);
    const result = await db.update(tickets).set({ status: "waiting_internal", updatedAt: new Date() }).where(and(eq(tickets.id, ticketId), eq(tickets.businessId, businessId)));
    if (result.rowsAffected === 0) return { success: false, error: "Ticket not found." };
    return { success: true, ticketId, escalationReason: reason };
  },
});
