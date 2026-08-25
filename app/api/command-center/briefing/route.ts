import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  aiEmployees,
  leads,
  followUps,
  customers,
} from "@/db/schema";

import { eq } from "drizzle-orm";

import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";


export async function GET() {

  try {

    const session =
      await auth.api.getSession({
        headers: await headers(),
      });


    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }


    const business = await getCurrentMembership();


    if (!business) {
      return NextResponse.json(
        {
          error: "Business not found",
        },
        {
          status: 404,
        },
      );
    }


    const [
      employees,
      sales,
      followUpList,
      customerList,
    ] =
      await Promise.all([

        db
          .select()
          .from(aiEmployees)
          .where(
            eq(
              aiEmployees.businessId,
              business.businessId,
            ),
          ),


        db
          .select()
          .from(leads)
          .where(
            eq(
              leads.businessId,
              business.businessId,
            ),
          ),


        db
          .select()
          .from(followUps)
          .where(
            eq(
              followUps.businessId,
              business.businessId,
            ),
          ),


        db
          .select()
          .from(customers)
          .where(
            eq(
              customers.businessId,
              business.businessId,
            ),
          ),

      ]);


    const prompt = `
You are Kuba, the CEO intelligence assistant.

Create a CEO-level business intelligence briefing.

Focus on:
- What is happening in the business now
- What requires the CEO's attention
- The most important action to take next

Business data:

AI Employees:
${employees.length}

Sales Opportunities:
${sales.length}

Customers:
${customerList.length}

Follow-ups:
${followUpList.length}


Rules:
- Be concise.
- Speak like a business advisor.
- Do not invent information.
- Mention recommended actions.
`;


    const result =
      await generateText({
        model:
          openai("gpt-4o-mini"),

        prompt: `${prompt}

Return ONLY valid JSON:

{
  "headline": "the most important business situation right now",
  "summary": "a CEO-focused explanation of what is happening and why it matters",
  "priorities": [
    "specific CEO action one",
    "specific CEO action two",
    "specific CEO action three"
  ]
}`,
      });

    let aiInsight;

    try {
      const cleaned = result.text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      aiInsight = JSON.parse(cleaned);
    } catch {
      aiInsight = {
        headline: "Business analysis available",
        summary: result.text,
        priorities: [],
      };
    }


    return NextResponse.json({
      headline: aiInsight.headline,
      summary: aiInsight.summary,
      metrics: {
        employees: employees.length,
        sales: sales.length,
        customers: customerList.length,
        followUps: followUpList.length,
      },
      priorities: aiInsight.priorities,
    });


  } catch(error) {

    console.error(
      "Executive briefing error",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to generate briefing",
      },
      {
        status:500,
      },
    );

  }

}
