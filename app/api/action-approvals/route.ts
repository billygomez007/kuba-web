import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, desc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  businessUsers,
} from "@/db/schema";

export async function GET() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json(
      { error: "You must be signed in." },
      { status: 401 },
    );
  }

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
    })
    .from(businessUsers)
    .where(
      eq(businessUsers.userId, session.user.id),
    )
    .limit(1);

  const business = membership[0];

  if (!business) {
    return NextResponse.json(
      { error: "No business is associated with this account." },
      { status: 404 },
    );
  }

  const approvals = await db
    .select()
    .from(actionApprovals)
    .where(
      and(
        eq(
          actionApprovals.businessId,
          business.businessId,
        ),
        eq(actionApprovals.status, "pending"),
      ),
    )
    .orderBy(desc(actionApprovals.createdAt));

  return NextResponse.json({
    success: true,
    approvals,
  });
}
