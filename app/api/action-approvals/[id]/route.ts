import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  businessUsers,
} from "@/db/schema";

export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
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

  const approval = await db
    .select()
    .from(actionApprovals)
    .where(
      and(
        eq(actionApprovals.id, id),
        eq(
          actionApprovals.businessId,
          business.businessId,
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
          business.businessId,
        ),
      ),
    )
    .returning();

  return NextResponse.json({
    success: true,
    approval: updated[0],
  });
}
