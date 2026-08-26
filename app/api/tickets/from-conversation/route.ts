import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { conversations, leads, tickets } from "@/db/schema";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOperationsContext } from "@/lib/customer-operations-auth";
import { TICKET_PRIORITIES, validateReferences } from "@/lib/customer-operations";
import { createAuditLog } from "@/lib/auth/audit";

export async function POST(request: Request) {
  const context = await getOperationsContext(PERMISSIONS.MESSAGING_MANAGE, "customer_ops.tickets");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  try {
    const body = await request.json();
    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    if (!conversationId) return NextResponse.json({ error: "Conversation is required." }, { status: 400 });
    const businessId = context.membership.businessId;
    const conversation = (await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, businessId))).limit(1))[0];
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const active = (await db.select({ id: tickets.id, ticketReference: tickets.ticketReference }).from(tickets).where(and(eq(tickets.businessId, businessId), eq(tickets.conversationId, conversationId), inArray(tickets.status, ["open", "in_progress", "waiting_customer", "waiting_internal"]))).limit(1))[0];
    if (active) return NextResponse.json({ success: true, existing: true, id: active.id, ticketReference: active.ticketReference });
    const lead = conversation.customerId
      ? (await db.select({ id: leads.id }).from(leads).where(and(eq(leads.businessId, businessId), eq(leads.customerId, conversation.customerId))).limit(1))[0]
      : null;
    const priority = TICKET_PRIORITIES.includes(body.priority) ? body.priority : "normal";
    const refs = { customerId: conversation.customerId, leadId: lead?.id || null, conversationId, branchId: null, assignedUserId: null, assignedHumanEmployeeId: null, assignedAiEmployeeId: null, assignedTeamId: null };
    await validateReferences(businessId, refs);
    const id = crypto.randomUUID();
    const now = new Date();
    await db.insert(tickets).values({ id, businessId, ticketReference: `SUP-${id.slice(0, 8).toUpperCase()}`, subject: typeof body.subject === "string" && body.subject.trim() ? body.subject.trim() : `Support request from ${conversation.customerName || "customer"}`, description: typeof body.description === "string" && body.description.trim() ? body.description.trim() : "Created from an existing customer conversation.", ...refs, status: "open", priority, source: "conversation", category: body.category || null, resolutionSummary: null, openedAt: now, firstResponseAt: null, resolvedAt: null, closedAt: null, createdBy: context.session.user.id, createdAt: now, updatedAt: now });
    await createAuditLog({ businessId, userId: context.session.user.id, action: "ticket.created", resource: "ticket", resourceId: id, metadata: { source: "conversation", conversationId, priority } });
    return NextResponse.json({ success: true, existing: false, id, ticketReference: `SUP-${id.slice(0, 8).toUpperCase()}` }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create ticket." }, { status: 400 });
  }
}
