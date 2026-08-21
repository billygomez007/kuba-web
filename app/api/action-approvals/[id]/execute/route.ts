import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
  communicationLogs,
} from "@/db/schema";
import { authorizationErrorResponse, logSecurityEvent, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
  const access = await requirePermission(PERMISSIONS.MESSAGING_MANAGE, request);

  const { id } = await context.params;

  const approval = await db
    .select()
    .from(actionApprovals)
    .where(
      and(
        eq(actionApprovals.id, id),
        eq(
          actionApprovals.businessId,
          access.business.id,
        ),
      ),
    )
    .limit(1);

  if (!approval[0]) {
    return NextResponse.json(
      { error: "Approval request not found." },
      { status: 404 },
    );
  }

  if (approval[0].status !== "approved") {
    return NextResponse.json(
      {
        error:
          "Action must be approved before execution.",
      },
      { status: 400 },
    );
  }

  // Provider connection will happen here:
  // WhatsApp
  // Akesel SMS
  // Akesel Email

  await db.insert(communicationLogs).values({
    id: crypto.randomUUID(),
    businessId: access.business.id,
    employeeId: null,
    customerId: null,
    leadId: null,
    channel: approval[0].channel,
    recipient: approval[0].recipient,
    message: approval[0].message,
    status: "sent",
    provider: "pending",
    providerMessageId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await db
    .update(actionApprovals)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(actionApprovals.id, id),
        eq(actionApprovals.businessId, access.business.id),
        eq(actionApprovals.status, "approved"),
      ),
    );

  await logSecurityEvent({
    context: access,
    request,
    action: "action.execute.recorded",
    resource: "action_approval",
    resourceId: id,
    result: "success",
  });

  return NextResponse.json({
    success: true,
    message:
      "Approved action executed and recorded.",
    channel:
      approval[0].channel,
  });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to execute approval." }, { status: 500 });
  }
}
