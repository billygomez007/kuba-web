import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  businessUsers,
} from "@/db/schema";

import { getChannelAdapter } from "@/lib/channels/router";
import { type ChannelType } from "@/lib/channels/types";
import { logAIActivity } from "@/lib/ai/activity-log";


export async function POST(
  request: Request,
) {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const membership = await db
    .select({
      businessId: businessUsers.businessId,
    })
    .from(businessUsers)
    .where(eq(businessUsers.userId, session.user.id))
    .limit(1);

  const business = membership[0];

  if (!business) {
    return NextResponse.json(
      { error: "No business is associated with this account." },
      { status: 404 },
    );
  }

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
            business.businessId,
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

  if (action[0].status !== "approved") {
    return NextResponse.json(
      {
        error: "Action must be approved before execution.",
      },
      { status: 400 },
    );
  }


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
        eq(actionApprovals.businessId, business.businessId),
      ),
    );


  return NextResponse.json({
    success:true,
  });

}
