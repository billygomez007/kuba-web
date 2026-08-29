import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployeeActionApprovals,
} from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { createAuditLog } from "@/lib/auth/audit";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";
import type { AIAction } from "@/lib/ai/authority";
import { performCreateLead } from "@/mastra/tools/create-lead";
import { performUpdateLead } from "@/mastra/tools/update-lead";
import { performCreateFollowUp } from "@/mastra/tools/create-follow-up";
import { performCompleteFollowUp } from "@/mastra/tools/complete-follow-up";
import { performCreateSalesActivity } from "@/mastra/tools/create-sales-activity";
import { performCreateAppointment, performUpdateAppointment } from "@/mastra/tools/appointment-tools";
import { performCreateSupportTicket, performEscalateTicket } from "@/mastra/tools/ticket-tools";
import { performCreateCustomer } from "@/lib/ai/tools/receptionist-tools";

/**
 * The single executor for every generic (non-messaging) AI-employee action
 * approval. Each entry calls the exact same function the originating tool
 * would have run directly had its policy said "allowed" — there is no
 * separate, divergent replay implementation per action.
 */
const EXECUTORS: Partial<Record<AIAction, (businessId: string, employeeId: string, payload: unknown) => Promise<unknown>>> = {
  create_lead: (b, e, p) => performCreateLead(b, e, p as Parameters<typeof performCreateLead>[2]),
  update_lead: (b, e, p) => performUpdateLead(b, e, p as Parameters<typeof performUpdateLead>[2]),
  create_follow_up: (b, e, p) => performCreateFollowUp(b, e, p as Parameters<typeof performCreateFollowUp>[2]),
  complete_follow_up: (b, e, p) => performCompleteFollowUp(b, e, p as Parameters<typeof performCompleteFollowUp>[2]),
  create_sales_activity: (b, e, p) => performCreateSalesActivity(b, e, p as Parameters<typeof performCreateSalesActivity>[2]),
  create_appointment: (b, e, p) => performCreateAppointment(b, e, p as Parameters<typeof performCreateAppointment>[2]),
  update_appointment: (b, e, p) => performUpdateAppointment(b, e, p as Parameters<typeof performUpdateAppointment>[2]),
  create_customer: (b, e, p) => performCreateCustomer(b, e, p as Parameters<typeof performCreateCustomer>[2]),
  create_ticket: (b, e, p) => performCreateSupportTicket(b, e, p as Parameters<typeof performCreateSupportTicket>[2]),
  escalate_ticket: (b, e, p) => performEscalateTicket(b, e, p as Parameters<typeof performEscalateTicket>[2]),
};

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.MESSAGING_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!hasCapability(await getBusinessEntitlements(membership.businessId), "business_ops.approvals")) {
    return NextResponse.json({ error: "Approvals require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["business_ops.approvals"] }, { status: 403 });
  }
  const approval = await db
    .select()
    .from(aiEmployeeActionApprovals)
    .where(and(eq(aiEmployeeActionApprovals.id, id), eq(aiEmployeeActionApprovals.businessId, membership.businessId)))
    .limit(1);

  if (!approval[0]) {
    return NextResponse.json(
      { error: "Approval request not found." },
      { status: 404 },
    );
  }

  const claimed = await db
    .update(aiEmployeeActionApprovals)
    .set({ status: "executing", updatedAt: new Date() })
    .where(and(eq(aiEmployeeActionApprovals.id, id), eq(aiEmployeeActionApprovals.businessId, membership.businessId), eq(aiEmployeeActionApprovals.status, "approved")))
    .returning({ id: aiEmployeeActionApprovals.id });
  if (!claimed[0]) return NextResponse.json({ error: "Action must be approved and not already executing." }, { status: 409 });

  const action = approval[0].action as AIAction;
  const executor = EXECUTORS[action];

  if (!executor) {
    await db.update(aiEmployeeActionApprovals).set({ status: "failed", updatedAt: new Date() }).where(eq(aiEmployeeActionApprovals.id, id));
    await createAuditLog({ businessId: membership.businessId, userId: user.id, action: "ai_approval.execute", resource: "ai_employee_action_approval", resourceId: id, description: "Approved action could not be executed: unknown action type.", metadata: { action } });
    return NextResponse.json({ error: "This approved action has no executor." }, { status: 500 });
  }

  let result: unknown;
  let success = true;
  try {
    const payload = JSON.parse(approval[0].payload);
    result = await executor(approval[0].businessId, approval[0].employeeId, payload);
    success = !(result && typeof result === "object" && "success" in result && (result as { success: boolean }).success === false);
  } catch (error) {
    success = false;
    result = { error: error instanceof Error ? error.message : "Execution failed." };
  }

  await db
    .update(aiEmployeeActionApprovals)
    .set({
      status: success ? "completed" : "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiEmployeeActionApprovals.id, id),
        eq(aiEmployeeActionApprovals.businessId, approval[0].businessId),
      ),
    );

  await createAuditLog({ businessId: membership.businessId, userId: user.id, action: "ai_approval.execute", resource: "ai_employee_action_approval", resourceId: id, description: success ? "Approved AI action executed." : "Approved AI action execution failed.", metadata: { action, success } });

  if (!success) {
    return NextResponse.json(
      {
        error: "The approved action could not be executed.",
        detail: result,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Approved action executed and recorded.",
    action,
    result,
  });
}
