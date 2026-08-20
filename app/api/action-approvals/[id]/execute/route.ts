import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  businessUsers,
  salesActivities,
  communicationLogs,
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

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
    })
    .from(businessUsers)
    .where(
      eq(
        businessUsers.userId,
        session.user.id,
      ),
    )
    .limit(1);

  const business = membership[0];

  if (!business) {
    return NextResponse.json(
      { error: "Business not found." },
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
    businessId: business.businessId,
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
      eq(actionApprovals.id, id),
    );

  return NextResponse.json({
    success: true,
    message:
      "Approved action executed and recorded.",
    channel:
      approval[0].channel,
  });
}
