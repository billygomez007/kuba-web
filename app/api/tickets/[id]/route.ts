import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { tickets, customers, branches, users, aiEmployees } from "@/db/schema";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOperationsContext } from "@/lib/customer-operations-auth";
import { assertTransition, TICKET_PRIORITIES, ticketTransitions, validateReferences } from "@/lib/customer-operations";
import { createAuditLog } from "@/lib/auth/audit";

const failure = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process ticket." }, { status: 400 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOperationsContext(PERMISSIONS.MESSAGING_VIEW, "customer_ops.tickets");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  const { id } = await params;
  const businessId = context.membership.businessId;
  const row = (await db.select({ ticket: tickets, customerName: customers.name, branchName: branches.name, assigneeName: users.name, aiEmployeeName: aiEmployees.name })
    .from(tickets)
    .leftJoin(customers, and(eq(customers.id, tickets.customerId), eq(customers.businessId, businessId)))
    .leftJoin(branches, and(eq(branches.id, tickets.branchId), eq(branches.businessId, businessId)))
    .leftJoin(users, eq(users.id, tickets.assignedUserId))
    .leftJoin(aiEmployees, and(eq(aiEmployees.id, tickets.assignedAiEmployeeId), eq(aiEmployees.businessId, businessId)))
    .where(and(eq(tickets.id, id), eq(tickets.businessId, businessId))).limit(1))[0];
  if (!row) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  return NextResponse.json({ ticket: { ...row.ticket, customerName: row.customerName, branchName: row.branchName, assigneeName: row.assigneeName || row.aiEmployeeName } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOperationsContext(PERMISSIONS.MESSAGING_MANAGE, "customer_ops.tickets");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  try {
    const { id } = await params;
    const current = (await db.select().from(tickets).where(and(eq(tickets.id, id), eq(tickets.businessId, context.membership.businessId))).limit(1))[0];
    if (!current) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    const body = await request.json();
    const nextStatus = body.status as keyof typeof ticketTransitions | undefined;
    if (nextStatus) assertTransition(ticketTransitions, current.status as keyof typeof ticketTransitions, nextStatus);
    if (!nextStatus && current.status === "closed") throw new Error("Closed tickets must be reopened before editing.");
    const priority = body.priority === undefined ? current.priority : body.priority;
    if (!TICKET_PRIORITIES.includes(priority)) throw new Error("Priority is invalid.");
    const refs = { customerId: body.customerId === undefined ? current.customerId : body.customerId || null, leadId: body.leadId === undefined ? current.leadId : body.leadId || null, conversationId: body.conversationId === undefined ? current.conversationId : body.conversationId || null, branchId: body.branchId === undefined ? current.branchId : body.branchId || null, assignedUserId: body.assignedUserId === undefined ? current.assignedUserId : body.assignedUserId || null, assignedHumanEmployeeId: body.assignedHumanEmployeeId === undefined ? current.assignedHumanEmployeeId : body.assignedHumanEmployeeId || null, assignedAiEmployeeId: body.assignedAiEmployeeId === undefined ? current.assignedAiEmployeeId : body.assignedAiEmployeeId || null, assignedTeamId: body.assignedTeamId === undefined ? current.assignedTeamId : body.assignedTeamId || null };
    await validateReferences(context.membership.businessId, refs);
    const status = nextStatus || current.status;
    const now = new Date();
    const timestamps = nextStatus === "resolved" ? { resolvedAt: now } : nextStatus === "closed" ? { closedAt: now } : nextStatus === "open" ? { resolvedAt: null, closedAt: null } : {};
    await db.update(tickets).set({ subject: body.subject === undefined ? current.subject : String(body.subject).trim(), description: body.description === undefined ? current.description : String(body.description).trim(), ...refs, status, priority, category: body.category === undefined ? current.category : body.category || null, resolutionSummary: body.resolutionSummary === undefined ? current.resolutionSummary : body.resolutionSummary || null, updatedAt: now, ...timestamps }).where(and(eq(tickets.id, id), eq(tickets.businessId, context.membership.businessId)));
    const actions = [];
    if (nextStatus) actions.push(`ticket.${nextStatus}`);
    if (body.assignedUserId !== undefined || body.assignedAiEmployeeId !== undefined || body.assignedTeamId !== undefined) actions.push("ticket.assigned");
    if (body.priority !== undefined && body.priority !== current.priority) actions.push("ticket.priority_changed");
    for (const action of actions) await createAuditLog({ businessId: context.membership.businessId, userId: context.session.user.id, action, resource: "ticket", resourceId: id, metadata: nextStatus ? { from: current.status, to: nextStatus } : {} });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
