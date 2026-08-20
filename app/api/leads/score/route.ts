import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  leads,
} from "@/db/schema";

import { calculateLeadScore } from "@/lib/ai/lead-scoring";
import { logAIActivity } from "@/lib/ai/activity-log";


export async function GET(
  request: Request,
) {

  const session =
    await auth.api.getSession({
      headers: await headers(),
    });


  if (!session?.user) {
    return NextResponse.json(
      {
        error:"Unauthorized",
      },
      {
        status:401,
      },
    );
  }


  const { searchParams } =
    new URL(request.url);


  const leadId =
    searchParams.get("id");


  if(!leadId){
    return NextResponse.json(
      {
        error:"Lead required",
      },
      {
        status:400,
      },
    );
  }


  const lead =
    await db
      .select()
      .from(leads)
      .where(
        eq(
          leads.id,
          leadId,
        ),
      )
      .limit(1);


  if(!lead[0]){
    return NextResponse.json(
      {
        error:"Lead not found",
      },
      {
        status:404,
      },
    );
  }


  const score =
    calculateLeadScore(
      lead[0],
    );


  if(lead[0].assignedEmployeeId){

    await logAIActivity({

      businessId:
        lead[0].businessId,

      employeeId:
        lead[0].assignedEmployeeId,

      type:
        "lead_scored",

      title:
        "Lead score updated",

      description:
        `Score: ${score.score}/100 (${score.category})`,

    });

  }


  return NextResponse.json({
    lead:lead[0],
    score,
  });

}
