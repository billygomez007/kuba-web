import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
} from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

import { getChannelAdapter } from "@/lib/channels/router";
import { type ChannelType } from "@/lib/channels/types";
import { logAIActivity } from "@/lib/ai/activity-log";


export async function POST(
  request: Request,
) {

  const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
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

  const {
    actionId,
  } = await request.json();


  const action =
    await db
      .select()
      .from(actionApprovals)
      .where(
        and(
          eq(
            actionApprovals.id,
            actionId,
          ),
          eq(
            actionApprovals.businessId,
            membership.businessId,
          ),
        ),
      )
      .limit(1);


  if(!action[0]){

    return NextResponse.json(
      {
        error:"Action not found",
      },
      {
        status:404,
      },
    );

  }

  const claimed = await db
    .update(actionApprovals)
    .set({ status: "executing", updatedAt: new Date() })
    .where(and(eq(actionApprovals.id, actionId), eq(actionApprovals.businessId, membership.businessId), eq(actionApprovals.status, "approved")))
    .returning({ id: actionApprovals.id });
  if (!claimed[0]) return NextResponse.json({ error: "Action must be approved and not already executing." }, { status: 409 });


  const adapter =
    getChannelAdapter(
      action[0].channel as ChannelType,
    );


  await adapter.send({

    businessId:
      action[0].businessId,

    conversationId:
      "",

    recipient:
      action[0].recipient,

    message:
      action[0].message,

  });


  if(action[0].employeeId){

    await logAIActivity({

      businessId:
        action[0].businessId,

      employeeId:
        action[0].employeeId,

      type:
        "action_completed",

      title:
        "AI action executed",

      description:
        `${action[0].channel}: ${action[0].message}`,

    });

  }


  await db
    .update(actionApprovals)
    .set({
      status:"completed",
      updatedAt:new Date(),
    })
    .where(
      and(
        eq(actionApprovals.id, actionId),
        eq(actionApprovals.businessId, membership.businessId),
      ),
    );


  return NextResponse.json({
    success:true,
  });

}
