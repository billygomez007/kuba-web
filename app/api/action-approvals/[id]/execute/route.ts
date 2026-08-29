import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
  communicationLogs,
} from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { createAuditLog } from "@/lib/auth/audit";
import { getChannelAdapter } from "@/lib/channels/router";
import { type ChannelType } from "@/lib/channels/types";
import { sendWhatsAppToPhone } from "@/lib/channels/whatsapp";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";

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
    .from(actionApprovals)
    .where(and(eq(actionApprovals.id, id), eq(actionApprovals.businessId, membership.businessId)))
    .limit(1);

  if (!approval[0]) {
    return NextResponse.json(
      { error: "Approval request not found." },
      { status: 404 },
    );
  }

  const claimed = await db
    .update(actionApprovals)
    .set({ status: "executing", updatedAt: new Date() })
    .where(and(eq(actionApprovals.id, id), eq(actionApprovals.businessId, membership.businessId), eq(actionApprovals.status, "approved")))
    .returning({ id: actionApprovals.id });
  if (!claimed[0]) return NextResponse.json({ error: "Action must be approved and not already executing." }, { status: 409 });

  // A proposed action (e.g. Sales requesting outreach to a lead) has no
  // existing conversation to resolve the WhatsApp 24-hour customer-service
  // window from, so the generic conversationId-based adapter would always
  // report the window closed. Resolve the window by phone number instead,
  // the same way any other AI-tool-initiated WhatsApp send does.
  const result =
    approval[0].channel === "whatsapp"
      ? await sendWhatsAppToPhone({
          businessId: approval[0].businessId,
          phone: approval[0].recipient,
          message: approval[0].message,
        })
      : await getChannelAdapter(approval[0].channel as ChannelType).send({
          businessId: approval[0].businessId,
          conversationId: "",
          recipient: approval[0].recipient,
          message: approval[0].message,
        });

  await db.insert(communicationLogs).values({
    id: crypto.randomUUID(),
    businessId: approval[0].businessId,
    employeeId: null,
    customerId: null,
    leadId: null,
    channel: approval[0].channel,
    recipient: approval[0].recipient,
    message: approval[0].message,
    status: result.success ? "sent" : "failed",
    provider: approval[0].channel,
    providerMessageId: result.externalMessageId || null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db
    .update(actionApprovals)
    .set({
      status: result.success ? "completed" : "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(actionApprovals.id, id),
        eq(actionApprovals.businessId, approval[0].businessId),
      ),
    );

  await createAuditLog({ businessId: membership.businessId, userId: user.id, action: "approval.execute", resource: "action_approval", resourceId: id, description: result.success ? "Approved action executed." : "Approved action execution failed.", metadata: { channel: approval[0].channel, success: result.success } });

  if (!result.success) {
    return NextResponse.json(
      {
        error: "The approved action could not be delivered.",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "Approved action executed and recorded.",
    channel:
      approval[0].channel,
  });
}
