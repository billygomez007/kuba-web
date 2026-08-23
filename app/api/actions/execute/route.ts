import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
} from "@/db/schema";

import { getChannelAdapter } from "@/lib/channels/router";
import { type ChannelType } from "@/lib/channels/types";
import { logAIActivity } from "@/lib/ai/activity-log";


export async function POST(
  request: Request,
) {

  const {
    actionId,
  } = await request.json();


  const action =
    await db
      .select()
      .from(actionApprovals)
      .where(
        eq(
          actionApprovals.id,
          actionId,
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
      eq(
        actionApprovals.id,
        actionId,
      ),
    );


  return NextResponse.json({
    success:true,
  });

}
