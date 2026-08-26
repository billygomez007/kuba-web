import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";

export async function GET() {
  const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
  if (!user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  if (!membership) {
    return NextResponse.json(
      { error: "No business is associated with this account." },
      { status: 404 },
    );
  }
  if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.MESSAGING_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  if (!hasCapability(await getBusinessEntitlements(membership.businessId), "business_ops.approvals")) {
    return NextResponse.json({ error: "Approvals require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["business_ops.approvals"] }, { status: 403 });
  }

  const approvals = await db
    .select()
    .from(actionApprovals)
    .where(eq(actionApprovals.businessId, membership.businessId))
    .orderBy(desc(actionApprovals.createdAt));

  return NextResponse.json({
    success: true,
    approvals,
  });
}
