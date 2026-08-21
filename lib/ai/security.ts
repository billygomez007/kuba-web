import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals, aiEmployees, aiEmployeeActivities } from "@/db/schema";

export type AIAction =
  | "create_customer"
  | "create_lead"
  | "update_lead"
  | "create_follow_up"
  | "complete_follow_up"
  | "record_sales_activity"
  | "external_communication";

const EMPLOYEE_ACTIONS: Record<string, ReadonlySet<AIAction>> = {
  receptionist: new Set(["create_customer", "create_lead"]),
  sales: new Set([
    "create_lead",
    "update_lead",
    "create_follow_up",
    "complete_follow_up",
    "record_sales_activity",
    "external_communication",
  ]),
  customer_support: new Set(),
};

export function isAIActionAllowed(employeeType: string, action: AIAction) {
  return EMPLOYEE_ACTIONS[employeeType]?.has(action) ?? false;
}

export async function requireAIEmployeeAction({
  businessId,
  employeeId,
  action,
}: {
  businessId: string;
  employeeId: string;
  action: AIAction;
}) {
  const employee = (await db.select().from(aiEmployees).where(and(
    eq(aiEmployees.id, employeeId),
    eq(aiEmployees.businessId, businessId),
    eq(aiEmployees.status, "active"),
  )).limit(1))[0];

  if (!employee) throw new Error("AI employee is not active for this business.");
  if (!isAIActionAllowed(employee.type, action)) {
    throw new Error("This AI employee is not permitted to perform this action.");
  }
  return employee;
}

export async function createPendingAIAction({
  businessId,
  employeeId,
  channel,
  recipient,
  message,
}: {
  businessId: string;
  employeeId: string;
  channel: "whatsapp" | "sms" | "email";
  recipient: string;
  message: string;
}) {
  const employee = await requireAIEmployeeAction({ businessId, employeeId, action: "external_communication" });
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(actionApprovals).values({
    id,
    businessId,
    employeeId: employee.id,
    channel,
    recipient,
    message,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(aiEmployeeActivities).values({
    id: crypto.randomUUID(),
    businessId,
    employeeId: employee.id,
    type: "action_approval_requested",
    title: "AI action awaiting approval",
    description: `${channel} communication requested.`,
    status: "pending",
    createdAt: now,
  });

  return { id, employee };
}
