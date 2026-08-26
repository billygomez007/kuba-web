import { and, eq, lt, gt, ne } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployees,
  appointments,
  branches,
  businessTeamMembers,
  businessTeams,
  businessUsers,
  conversations,
  customers,
  hrEmployees,
  leads,
} from "@/db/schema";
import { isValidTimezone as isValidIanaTimezone } from "@/lib/localization/registry";

export const APPOINTMENT_STATUSES = ["scheduled", "confirmed", "completed", "cancelled", "no_show"] as const;
export const TICKET_STATUSES = ["open", "in_progress", "waiting_customer", "waiting_internal", "resolved", "closed"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export function parseDate(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${label} must be a valid ISO date.`);
  return date;
}

export function validateTimezone(value: unknown) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Timezone is required.");
  if (!isValidIanaTimezone(value)) throw new Error("Timezone is invalid.");
  return value;
}

export async function validateReferences(businessId: string, values: {
  customerId?: string | null;
  leadId?: string | null;
  conversationId?: string | null;
  branchId?: string | null;
  assignedUserId?: string | null;
  assignedHumanEmployeeId?: string | null;
  assignedAiEmployeeId?: string | null;
  assignedTeamId?: string | null;
}) {
  const checks = [
    ["Customer", values.customerId, customers],
    ["Lead", values.leadId, leads],
    ["Conversation", values.conversationId, conversations],
    ["Branch", values.branchId, branches],
    ["User", values.assignedUserId, businessUsers],
    ["Human employee", values.assignedHumanEmployeeId, hrEmployees],
    ["AI employee", values.assignedAiEmployeeId, aiEmployees],
    ["Team", values.assignedTeamId, businessTeams],
  ] as const;

  await Promise.all(checks.map(async ([label, id, table]) => {
    if (!id) return;
    const condition = table === businessUsers
      ? and(eq(businessUsers.userId, id), eq(businessUsers.businessId, businessId))
      : and(eq(table.id, id), eq(table.businessId, businessId));
    const row = await db.select({ id: table.id }).from(table).where(condition).limit(1);
    if (!row[0]) throw new Error(`${label} does not belong to the selected business.`);
  }));

  if (values.assignedTeamId && values.assignedUserId) {
    const membership = await db.select({ id: businessTeamMembers.id }).from(businessTeamMembers)
      .innerJoin(businessUsers, eq(businessUsers.id, businessTeamMembers.businessUserId))
      .where(and(eq(businessTeamMembers.teamId, values.assignedTeamId), eq(businessUsers.userId, values.assignedUserId), eq(businessUsers.businessId, businessId))).limit(1);
    if (!membership[0]) throw new Error("Assigned user is not a member of the selected team.");
  }
}

export async function assertAppointmentConflict(businessId: string, startAt: Date, endAt: Date, assignment: { assignedUserId?: string | null; assignedAiEmployeeId?: string | null }, excludeId?: string) {
  const resource = assignment.assignedUserId
    ? eq(appointments.assignedUserId, assignment.assignedUserId)
    : assignment.assignedAiEmployeeId
      ? eq(appointments.assignedAiEmployeeId, assignment.assignedAiEmployeeId)
      : null;
  if (!resource) return;
  const conditions = [eq(appointments.businessId, businessId), resource, lt(appointments.startAt, endAt), gt(appointments.endAt, startAt), ne(appointments.status, "cancelled")];
  if (excludeId) conditions.push(ne(appointments.id, excludeId));
  const conflict = await db.select({ id: appointments.id }).from(appointments).where(and(...conditions)).limit(1);
  if (conflict[0]) throw new Error("The assigned resource already has an overlapping active appointment.");
}

export const appointmentTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  scheduled: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const ticketTransitions: Record<TicketStatus, TicketStatus[]> = {
  open: ["in_progress", "waiting_customer", "waiting_internal", "resolved", "closed"],
  in_progress: ["waiting_customer", "waiting_internal", "resolved", "closed"],
  waiting_customer: ["in_progress", "resolved", "closed"],
  waiting_internal: ["in_progress", "resolved", "closed"],
  resolved: ["open", "closed"],
  closed: ["open"],
};

export function assertTransition<T extends string>(transitions: Record<T, T[]>, current: T, next: T) {
  if (!transitions[current]?.includes(next)) throw new Error(`Cannot change status from ${current} to ${next}.`);
}

export function ticketReference() {
  return `SUP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}
