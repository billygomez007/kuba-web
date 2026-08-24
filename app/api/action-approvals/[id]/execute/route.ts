import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  communicationLogs,
} from "@/db/schema";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getChannelAdapter } from "@/lib/channels/router";
import { type ChannelType } from "@/lib/channels/types";

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

  const approval = await db
    .select()
    .from(actionApprovals)
    .where(eq(actionApprovals.id, id))
    .limit(1);

  if (!approval[0]) {
    return NextResponse.json(
      { error: "Approval request not found." },
      { status: 404 },
    );
  }

  const membership = await getBusinessMembership(
    session.user.id,
    approval[0].businessId,
  );

  if (
    !membership ||
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.MESSAGING_MANAGE,
    )
  ) {
    return NextResponse.json(
      { error: "Forbidden." },
      { status: 403 },
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

  const adapter = getChannelAdapter(
    approval[0].channel as ChannelType,
  );

  const result = await adapter.send({
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
