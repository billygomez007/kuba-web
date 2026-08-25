import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

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
