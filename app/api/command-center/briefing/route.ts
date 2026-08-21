import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessUsers,
  aiEmployees,
  leads,
  followUps,
  customers,
} from "@/db/schema";

import { eq } from "drizzle-orm";

import { generateObject } from "ai";
import { z } from "zod";
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


    const membership =
      await db
        .select({
          businessId:
            businessUsers.businessId,
        })
        .from(businessUsers)
        .where(
          eq(
            businessUsers.userId,
            session.user.id,
          ),
        )
        .limit(1);


    const business =
      membership[0];


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

Analyze this company like an executive advisor.

Your purpose is to help the CEO understand:
- What is happening in the business
- What requires attention
- What opportunities exist
- What actions should happen next

Create an executive briefing using simple professional business language.

Important rules:
- Do not use markdown.
- Do not use # symbols.
- Do not use bullet points.
- Do not use asterisks.
- Keep responses concise and executive-focused.
- Return ONLY valid JSON.

Your response must follow this exact structure:

{
  "headline": "The most important business situation right now",
  "summary": "A short CEO-level explanation",
  "sections": [
    {
      "title": "Business Overview",
      "content": "Explain the current business state"
    },
    {
      "title": "Key Insights",
      "content": "Explain important observations, risks, or opportunities"
    },
    {
      "title": "Growth Opportunities",
      "content": "Explain ways the business can improve"
    }
  ],
  "actions": [
    {
      "title": "Action name",
      "description": "Explain what the CEO should do next"
    }
  ]
}


Business data:

AI Employees:
${employees.length}

Sales Opportunities:
${sales.length}

Customers:
${customerList.length}

Follow-ups:
${followUpList.length}

`;

    const result =
      await generateObject({
        model:
          openai("gpt-4o-mini"),

        schema: z.object({
          headline: z.string(),

          summary: z.string(),

          sections: z.array(
            z.object({
              title: z.string(),
              content: z.string(),
            }),
          ),

          actions: z.array(
            z.object({
              title: z.string(),
              description: z.string(),
            }),
          ),
        }),

        prompt,
      });


    const aiInsight = result.object;


    return NextResponse.json({
      headline: aiInsight.headline,
      summary: aiInsight.summary,
      metrics: {
        employees: employees.length,
        sales: sales.length,
        customers: customerList.length,
        followUps: followUpList.length,
      },
      sections: aiInsight.sections || [],
      actions: aiInsight.actions || [],
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
