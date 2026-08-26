import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { appointments, customers, branches, aiEmployees, users } from "@/db/schema";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getOperationsContext } from "@/lib/customer-operations-auth";
import { appointmentTransitions, assertAppointmentConflict, assertTransition, parseDate, validateReferences, validateTimezone } from "@/lib/customer-operations";
import { createAuditLog } from "@/lib/auth/audit";

const responseError = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process appointment." }, { status: 400 });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOperationsContext(PERMISSIONS.RECEPTION_VIEW, "customer_ops.appointments");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  const { id } = await params;
  const businessId = context.membership.businessId;
  const row = (await db.select({ appointment: appointments, customerName: customers.name, branchName: branches.name, assigneeName: users.name, aiEmployeeName: aiEmployees.name })
    .from(appointments)
    .leftJoin(customers, and(eq(customers.id, appointments.customerId), eq(customers.businessId, businessId)))
    .leftJoin(branches, and(eq(branches.id, appointments.branchId), eq(branches.businessId, businessId)))
    .leftJoin(users, eq(users.id, appointments.assignedUserId))
    .leftJoin(aiEmployees, and(eq(aiEmployees.id, appointments.assignedAiEmployeeId), eq(aiEmployees.businessId, businessId)))
    .where(and(eq(appointments.id, id), eq(appointments.businessId, businessId))).limit(1))[0];
  if (!row) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
  return NextResponse.json({ appointment: { ...row.appointment, customerName: row.customerName, branchName: row.branchName, assigneeName: row.assigneeName || row.aiEmployeeName } });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOperationsContext(PERMISSIONS.RECEPTION_MANAGE, "customer_ops.appointments");
  if ("error" in context) return NextResponse.json(context, { status: context.status });
  try {
    const { id } = await params;
    const current = (await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.businessId, context.membership.businessId))).limit(1))[0];
    if (!current) return NextResponse.json({ error: "Appointment not found." }, { status: 404 });
    const body = await request.json();
    const now = new Date();
    const nextStatus = body.status as keyof typeof appointmentTransitions | undefined;
    if (nextStatus) {
      assertTransition(appointmentTransitions, current.status as keyof typeof appointmentTransitions, nextStatus);
    }
    if (!nextStatus && ["completed", "cancelled", "no_show"].includes(current.status)) throw new Error("Closed appointments cannot be edited.");
    const startAt = body.startAt === undefined ? current.startAt : parseDate(body.startAt, "startAt");
    const endAt = body.endAt === undefined ? current.endAt : parseDate(body.endAt, "endAt");
    if (startAt >= endAt) throw new Error("startAt must be before endAt.");
    const refs = { customerId: body.customerId === undefined ? current.customerId : body.customerId || null, leadId: body.leadId === undefined ? current.leadId : body.leadId || null, conversationId: body.conversationId === undefined ? current.conversationId : body.conversationId || null, branchId: body.branchId === undefined ? current.branchId : body.branchId || null, assignedUserId: body.assignedUserId === undefined ? current.assignedUserId : body.assignedUserId || null, assignedHumanEmployeeId: body.assignedHumanEmployeeId === undefined ? current.assignedHumanEmployeeId : body.assignedHumanEmployeeId || null, assignedAiEmployeeId: body.assignedAiEmployeeId === undefined ? current.assignedAiEmployeeId : body.assignedAiEmployeeId || null };
    await validateReferences(context.membership.businessId, refs);
    await assertAppointmentConflict(context.membership.businessId, startAt, endAt, refs, id);
    const status = nextStatus || current.status;
    const timestamp = nextStatus === "confirmed" ? { confirmedAt: now } : nextStatus === "completed" ? { completedAt: now } : nextStatus === "cancelled" ? { cancelledAt: now, cancellationReason: body.cancellationReason || null } : nextStatus === "no_show" ? { noShowAt: now } : {};
    await db.update(appointments).set({ title: body.title === undefined ? current.title : String(body.title).trim(), description: body.description === undefined ? current.description : body.description || null, ...refs, startAt, endAt, timezone: body.timezone === undefined ? current.timezone : validateTimezone(body.timezone), status, location: body.location === undefined ? current.location : body.location || null, meetingUrl: body.meetingUrl === undefined ? current.meetingUrl : body.meetingUrl || null, updatedAt: now, ...timestamp }).where(and(eq(appointments.id, id), eq(appointments.businessId, context.membership.businessId)));
    const action = nextStatus ? `appointment.${nextStatus}` : "appointment.updated";
    await createAuditLog({ businessId: context.membership.businessId, userId: context.session.user.id, action, resource: "appointment", resourceId: id, metadata: nextStatus ? { from: current.status, to: nextStatus } : {} });
    return NextResponse.json({ success: true });
  } catch (error) { return responseError(error); }
}
