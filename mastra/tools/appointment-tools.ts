import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { appointments } from "@/db/schema";
import { assertAppointmentConflict, appointmentTransitions, assertTransition, parseDate, validateReferences, validateTimezone } from "@/lib/customer-operations";
import { requireBusinessId } from "@/mastra/tools/business-context";

const appointmentInput = z.object({ appointmentId: z.string() });

export const getAppointmentsTool = createTool({
  id: "get-appointments",
  description: "Retrieve appointments belonging to the current business.",
  inputSchema: z.object({ status: z.string().optional(), customerId: z.string().optional() }),
  execute: async ({ status, customerId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const conditions = [eq(appointments.businessId, businessId)];
    if (status) conditions.push(eq(appointments.status, status));
    if (customerId) conditions.push(eq(appointments.customerId, customerId));
    return { appointments: await db.select().from(appointments).where(and(...conditions)).orderBy(desc(appointments.startAt)).limit(50) };
  },
});

export const createAppointmentTool = createTool({
  id: "create-appointment",
  description: "Create an appointment for the current business after validating all linked records.",
  inputSchema: z.object({ title: z.string(), startAt: z.string(), endAt: z.string(), timezone: z.string(), customerId: z.string().optional(), leadId: z.string().optional(), conversationId: z.string().optional(), branchId: z.string().optional(), assignedUserId: z.string().optional(), assignedAiEmployeeId: z.string().optional() }),
  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const startAt = parseDate(input.startAt, "startAt"); const endAt = parseDate(input.endAt, "endAt");
    if (startAt >= endAt) throw new Error("startAt must be before endAt.");
    const timezone = validateTimezone(input.timezone);
    const refs = { customerId: input.customerId || null, leadId: input.leadId || null, conversationId: input.conversationId || null, branchId: input.branchId || null, assignedUserId: input.assignedUserId || null, assignedHumanEmployeeId: null, assignedAiEmployeeId: input.assignedAiEmployeeId || null };
    await validateReferences(businessId, refs); await assertAppointmentConflict(businessId, startAt, endAt, refs);
    const id = crypto.randomUUID(); const now = new Date();
    await db.insert(appointments).values({ id, businessId, title: input.title.trim(), description: null, ...refs, startAt, endAt, timezone, status: "scheduled", appointmentType: "meeting", meetingMode: "in_person", location: null, meetingUrl: null, createdBy: "ai-receptionist", createdAt: now, updatedAt: now, confirmedAt: null, completedAt: null, cancelledAt: null, noShowAt: null, cancellationReason: null });
    return { success: true, appointmentId: id };
  },
});

export const updateAppointmentTool = createTool({
  id: "update-appointment",
  description: "Reschedule or cancel an appointment belonging to the current business.",
  inputSchema: appointmentInput.extend({ status: z.enum(["confirmed", "cancelled"]).optional(), startAt: z.string().optional(), endAt: z.string().optional(), cancellationReason: z.string().optional() }),
  execute: async ({ appointmentId, status, startAt, endAt, cancellationReason }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const current = (await db.select().from(appointments).where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, businessId))).limit(1))[0];
    if (!current) return { success: false, error: "Appointment not found." };
    if (status) assertTransition(appointmentTransitions, current.status as keyof typeof appointmentTransitions, status);
    const nextStart = startAt ? parseDate(startAt, "startAt") : current.startAt; const nextEnd = endAt ? parseDate(endAt, "endAt") : current.endAt;
    if (nextStart >= nextEnd) throw new Error("startAt must be before endAt.");
    await assertAppointmentConflict(businessId, nextStart, nextEnd, current, appointmentId);
    const now = new Date();
    await db.update(appointments).set({ startAt: nextStart, endAt: nextEnd, status: status || current.status, cancellationReason: status === "cancelled" ? cancellationReason || null : current.cancellationReason, cancelledAt: status === "cancelled" ? now : current.cancelledAt, updatedAt: now }).where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, businessId)));
    return { success: true, appointmentId };
  },
});
