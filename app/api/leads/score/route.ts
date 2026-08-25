import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  leads,
} from "@/db/schema";

import { calculateLeadScore } from "@/lib/ai/lead-scoring";
import { logAIActivity } from "@/lib/ai/activity-log";
import { requireBusinessMembership } from "@/lib/auth/tenant";


export async function GET(
  request: Request,
) {

  const { user, membership, error } = await requireBusinessMembership();

  if (!user) {
    return NextResponse.json(
      {
        error:"Unauthorized",
      },
      {
        status:401,
      },
    );
  }

  if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });


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
        and(eq(leads.id, leadId), eq(leads.businessId, membership.businessId)),
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
