import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
} from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { createAuditLog } from "@/lib/auth/audit";
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

  const body = await request.json();
  const decision = String(body.decision || "").trim();

  if (!["approved", "rejected"].includes(decision)) {
    return NextResponse.json(
      { error: "Decision must be approved or rejected." },
      { status: 400 },
    );
  }

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

  if (approval[0].status !== "pending") {
    return NextResponse.json(
      { error: "This approval has already been decided." },
      { status: 409 },
    );
  }

  const updated = await db
    .update(actionApprovals)
    .set({
      status: decision,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(actionApprovals.id, id),
        eq(
          actionApprovals.businessId,
          approval[0].businessId,
        ),
      ),
    )
    .returning();

  await createAuditLog({ businessId: membership.businessId, userId: user.id, action: `approval.${decision}`, resource: "action_approval", resourceId: id, description: `${decision} ${approval[0].channel} action for ${approval[0].recipient}` });

  return NextResponse.json({
    success: true,
    approval: updated[0],
  });
}
