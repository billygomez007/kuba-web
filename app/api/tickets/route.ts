import { NextResponse } from "next/server";
import { and, desc, eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { tickets, customers, branches, users, aiEmployees } from "@/db/schema";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOperationsContext } from "@/lib/customer-operations-auth";
import { TICKET_PRIORITIES, validateReferences } from "@/lib/customer-operations";
import { createAuditLog } from "@/lib/auth/audit";

const failure = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process ticket." }, { status: 400 });

export async function GET(request: Request) {
  const context = await getOperationsContext(PERMISSIONS.MESSAGING_VIEW, "customer_ops.tickets");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  const params = new URL(request.url).searchParams;
  const businessId = context.membership.businessId;
  const conditions = [and(eq(tickets.businessId, businessId))!];
  for (const key of ["status", "priority", "customerId", "branchId", "assignedUserId", "assignedAiEmployeeId"] as const) {
    const value = params.get(key);
    if (value) conditions.push(eq(tickets[key], value));
  }
  const search = params.get("search")?.trim().toLowerCase();
  if (search) conditions.push(or(sql`lower(${tickets.ticketReference}) like ${`%${search}%`}`, sql`lower(${tickets.subject}) like ${`%${search}%`}`, sql`lower(coalesce(${customers.name}, '')) like ${`%${search}%`}`)!);
  const rows = await db.select({ ticket: tickets, customerName: customers.name, branchName: branches.name, assigneeName: users.name, aiEmployeeName: aiEmployees.name })
    .from(tickets)
    .leftJoin(customers, and(eq(customers.id, tickets.customerId), eq(customers.businessId, businessId)))
    .leftJoin(branches, and(eq(branches.id, tickets.branchId), eq(branches.businessId, businessId)))
    .leftJoin(users, eq(users.id, tickets.assignedUserId))
    .leftJoin(aiEmployees, and(eq(aiEmployees.id, tickets.assignedAiEmployeeId), eq(aiEmployees.businessId, businessId)))
    .where(and(...conditions)).orderBy(desc(tickets.updatedAt)).limit(100);
  return NextResponse.json({ tickets: rows.map((row) => ({ ...row.ticket, customerName: row.customerName, branchName: row.branchName, assigneeName: row.assigneeName || row.aiEmployeeName })) });
}

export async function POST(request: Request) {
  const context = await getOperationsContext(PERMISSIONS.MESSAGING_MANAGE, "customer_ops.tickets");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  try {
    const body = await request.json();
    const subject = String(body.subject || "").trim();
    const description = String(body.description || "").trim();
    if (!subject || !description) throw new Error("Subject and description are required.");
    const priority = body.priority || "normal";
    if (!TICKET_PRIORITIES.includes(priority)) throw new Error("Priority is invalid.");
    const refs = { customerId: body.customerId || null, leadId: body.leadId || null, conversationId: body.conversationId || null, branchId: body.branchId || null, assignedUserId: body.assignedUserId || null, assignedHumanEmployeeId: body.assignedHumanEmployeeId || null, assignedAiEmployeeId: body.assignedAiEmployeeId || null, assignedTeamId: body.assignedTeamId || null };
    await validateReferences(context.membership.businessId, refs);
    const now = new Date();
    const id = crypto.randomUUID();
    await db.insert(tickets).values({ id, businessId: context.membership.businessId, ticketReference: `SUP-${id.slice(0, 8).toUpperCase()}`, subject, description, ...refs, status: "open", priority, source: body.source || "manual", category: body.category || null, resolutionSummary: null, openedAt: now, firstResponseAt: null, resolvedAt: null, closedAt: null, createdBy: context.session.user.id, createdAt: now, updatedAt: now });
    await createAuditLog({ businessId: context.membership.businessId, userId: context.session.user.id, action: "ticket.created", resource: "ticket", resourceId: id, metadata: { priority, source: body.source || "manual" } });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) { return failure(error); }
}
