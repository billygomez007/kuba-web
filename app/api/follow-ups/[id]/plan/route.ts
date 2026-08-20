import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { kubaSalesAgent } from "@/mastra/agents/sales";
import {
  businessUsers,
  followUps,
  leads,
} from "@/db/schema";


export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {

    const session = await auth.api.getSession({
      headers: await headers(),
    });


    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
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
        { error: "Business not found" },
        { status: 404 },
      );
    }


    const result = await db
      .select({
        followUp: followUps,
        lead: leads,
      })
      .from(followUps)
      .leftJoin(
        leads,
        eq(
          leads.id,
          followUps.leadId,
        ),
      )
      .where(
        and(
          eq(
            followUps.id,
            id,
          ),
          eq(
            followUps.businessId,
            business.businessId,
          ),
        ),
      )
      .limit(1);


    const item = result[0];


    if (!item) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 },
      );
    }


    const prompt = `
You are handling a specific sales follow-up.

Follow-up information:

${JSON.stringify(item.followUp, null, 2)}

Lead information:

${JSON.stringify(item.lead, null, 2)}

Create a practical sales follow-up plan.

Return ONLY valid JSON.

Use this exact structure:

{
  "nextAction": "The recommended next sales action",
  "reason": "Why this action is recommended",
  "customerMessage": "A personalized message to send to the customer",
  "confidence": "high, medium, or low"
}

Rules:
- Do not invent customer information.
- Use only the information provided.
- Keep recommendations practical.
- Return JSON only. No markdown. No explanation outside JSON.
`;


    console.time("Kuba Sales Plan Generation");

    const aiResult = await kubaSalesAgent.generate(
      prompt,
    );

    console.timeEnd("Kuba Sales Plan Generation");


    let plan;

    try {
      const cleaned = aiResult.text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      plan = JSON.parse(cleaned);

    } catch {
      plan = {
        nextAction: aiResult.text,
        reason: "Kuba generated a sales recommendation.",
        customerMessage: "",
        confidence: "medium",
      };
    }


    return NextResponse.json(plan);



  } catch (error) {

    console.error(
      "Follow-up plan error",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to create action plan",
      },
      {
        status: 500,
      },
    );
  }
}
