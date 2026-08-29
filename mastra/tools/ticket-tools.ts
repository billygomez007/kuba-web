import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { tickets } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { TICKET_PRIORITIES, validateReferences } from "@/lib/customer-operations";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createTicketInput = z.object({ subject: z.string(), description: z.string(), priority: z.enum(["low", "normal", "high", "urgent"]).optional(), customerId: z.string().optional(), leadId: z.string().optional(), conversationId: z.string().optional(), branchId: z.string().optional() });

export async function performCreateSupportTicket(businessId: string, employeeId: string, input: z.infer<typeof createTicketInput>) {
  const priority = input.priority || "normal";
  if (!TICKET_PRIORITIES.includes(priority)) throw new Error("Priority is invalid.");
  const refs = { customerId: input.customerId || null, leadId: input.leadId || null, conversationId: input.conversationId || null, branchId: input.branchId || null, assignedUserId: null, assignedHumanEmployeeId: null, assignedAiEmployeeId: null, assignedTeamId: null };
  await validateReferences(businessId, refs);
  const id = crypto.randomUUID(); const now = new Date();
  await db.insert(tickets).values({ id, businessId, ticketReference: `SUP-${id.slice(0, 8).toUpperCase()}`, subject: input.subject.trim(), description: input.description.trim(), ...refs, status: "open", priority, source: "ai", category: null, resolutionSummary: null, openedAt: now, firstResponseAt: null, resolvedAt: null, closedAt: null, createdBy: "ai-customer-support", createdAt: now, updatedAt: now });
  await createAuditLog({ businessId, userId: null, action: "ai.create_ticket", resource: "ticket", resourceId: id, description: `AI employee created support ticket "${input.subject.trim()}".`, metadata: { employeeId } });
  return { success: true, ticketId: id };
}

const escalateTicketInput = z.object({ ticketId: z.string(), reason: z.string() });

export async function performEscalateTicket(businessId: string, employeeId: string, { ticketId, reason }: z.infer<typeof escalateTicketInput>) {
  const result = await db.update(tickets).set({ status: "waiting_internal", updatedAt: new Date() }).where(and(eq(tickets.id, ticketId), eq(tickets.businessId, businessId)));
  if (result.rowsAffected === 0) return { success: false, error: "Ticket not found." };
  await createAuditLog({ businessId, userId: null, action: "ai.escalate_ticket", resource: "ticket", resourceId: ticketId, description: `AI employee escalated ticket for human attention: ${reason}`, metadata: { employeeId } });
  return { success: true, ticketId, escalationReason: reason };
}

export const getTicketsTool = createTool({
  id: "get-support-tickets",
  description: "Retrieve support tickets belonging to the current business.",
  inputSchema: z.object({ status: z.string().optional(), customerId: z.string().optional(), ticketId: z.string().optional() }),
  execute: async ({ status, customerId, ticketId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_tickets" });
    if (!decision.ok) return { tickets: [], error: decision.message };
    const conditions = [eq(tickets.businessId, businessId)];
    if (status) conditions.push(eq(tickets.status, status)); if (customerId) conditions.push(eq(tickets.customerId, customerId)); if (ticketId) conditions.push(eq(tickets.id, ticketId));
    return { tickets: await db.select().from(tickets).where(and(...conditions)).orderBy(desc(tickets.updatedAt)).limit(50) };
  },
});

export const createSupportTicketTool = createTool({
  id: "create-support-ticket",
  description: "Create a support ticket for the current business. Creation does not resolve or close the ticket.",
  inputSchema: createTicketInput,
  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_ticket" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_ticket", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateSupportTicket(businessId, employeeId, input);
  },
});

export const requestTicketEscalationTool = createTool({
  id: "request-ticket-escalation",
  description: "Request human attention for an existing support ticket. This tool cannot resolve, close, or reopen tickets.",
  inputSchema: escalateTicketInput,
  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "escalate_ticket" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "escalate_ticket", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performEscalateTicket(businessId, employeeId, input);
  },
});
