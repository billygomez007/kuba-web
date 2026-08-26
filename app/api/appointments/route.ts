import { NextResponse } from "next/server";
import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { appointments, customers, branches, aiEmployees, users } from "@/db/schema";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOperationsContext } from "@/lib/customer-operations-auth";
import { assertAppointmentConflict, parseDate, validateReferences, validateTimezone } from "@/lib/customer-operations";
import { createAuditLog } from "@/lib/auth/audit";
import { getBusinessDayBounds, getBusinessLocalization } from "@/lib/localization";

const errorResponse = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process appointment." }, { status: 400 });

export async function GET(request: Request) {
  const context = await getOperationsContext(PERMISSIONS.RECEPTION_VIEW, "customer_ops.appointments");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  const params = new URL(request.url).searchParams;
  const businessId = context.membership.businessId;
  const conditions = [eq(appointments.businessId, businessId)];
  const status = params.get("status");
  const customerId = params.get("customerId");
  const assignee = params.get("assignee");
  const branchId = params.get("branchId");
  const search = params.get("search")?.trim();
  if (status) conditions.push(eq(appointments.status, status));
  if (customerId) conditions.push(eq(appointments.customerId, customerId));
  if (branchId) conditions.push(eq(appointments.branchId, branchId));
  if (assignee) conditions.push(or(eq(appointments.assignedUserId, assignee), eq(appointments.assignedAiEmployeeId, assignee))!);
  if (params.get("today") === "true") {
    const localization = await getBusinessLocalization(businessId);
    const { start, end } = getBusinessDayBounds(localization.timezone);
    conditions.push(gte(appointments.startAt, start), lte(appointments.startAt, end));
  }
  if (params.get("upcoming") === "true") conditions.push(gte(appointments.startAt, new Date()));
  if (params.get("past") === "true") conditions.push(lte(appointments.endAt, new Date()));
  if (params.get("from")) conditions.push(gte(appointments.startAt, parseDate(params.get("from"), "from")));
  if (params.get("to")) conditions.push(lte(appointments.startAt, parseDate(params.get("to"), "to")));
  const rows = await db.select({ appointment: appointments, customerName: customers.name, branchName: branches.name, assigneeName: users.name, aiEmployeeName: aiEmployees.name })
    .from(appointments)
    .leftJoin(customers, and(eq(customers.id, appointments.customerId), eq(customers.businessId, businessId)))
    .leftJoin(branches, and(eq(branches.id, appointments.branchId), eq(branches.businessId, businessId)))
    .leftJoin(users, eq(users.id, appointments.assignedUserId))
    .leftJoin(aiEmployees, and(eq(aiEmployees.id, appointments.assignedAiEmployeeId), eq(aiEmployees.businessId, businessId)))
    .where(and(...(search ? [...conditions, or(sql`lower(${appointments.title}) like ${`%${search.toLowerCase()}%`}`, sql`lower(coalesce(${customers.name}, '')) like ${`%${search.toLowerCase()}%`}`)!] : conditions)))
    .orderBy(desc(appointments.startAt)).limit(100);
  return NextResponse.json({ appointments: rows.map((row) => ({ ...row.appointment, customerName: row.customerName, branchName: row.branchName, assigneeName: row.assigneeName || row.aiEmployeeName })) });
}

export async function POST(request: Request) {
  const context = await getOperationsContext(PERMISSIONS.RECEPTION_MANAGE, "customer_ops.appointments");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  try {
    const body = await request.json();
    const title = String(body.title || "").trim();
    if (!title) throw new Error("Title is required.");
    const startAt = parseDate(body.startAt, "startAt");
    const endAt = parseDate(body.endAt, "endAt");
    if (startAt >= endAt) throw new Error("startAt must be before endAt.");
    if (endAt.getTime() - startAt.getTime() > 24 * 60 * 60 * 1000) throw new Error("Appointment duration cannot exceed 24 hours.");
    const timezone = validateTimezone(body.timezone);
    const values = { customerId: body.customerId || null, leadId: body.leadId || null, conversationId: body.conversationId || null, branchId: body.branchId || null, assignedUserId: body.assignedUserId || null, assignedHumanEmployeeId: body.assignedHumanEmployeeId || null, assignedAiEmployeeId: body.assignedAiEmployeeId || null };
    await validateReferences(context.membership.businessId, values);
    await assertAppointmentConflict(context.membership.businessId, startAt, endAt, values);
    const now = new Date();
    const id = crypto.randomUUID();
    await db.insert(appointments).values({ id, businessId: context.membership.businessId, title, description: body.description || null, ...values, startAt, endAt, timezone, status: "scheduled", appointmentType: body.appointmentType || "meeting", meetingMode: body.meetingMode || "in_person", location: body.location || null, meetingUrl: body.meetingUrl || null, createdBy: context.session.user.id, createdAt: now, updatedAt: now, confirmedAt: null, completedAt: null, cancelledAt: null, noShowAt: null, cancellationReason: null });
    await createAuditLog({ businessId: context.membership.businessId, userId: context.session.user.id, action: "appointment.created", resource: "appointment", resourceId: id, metadata: { status: "scheduled" } });
    return NextResponse.json({ success: true, id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
