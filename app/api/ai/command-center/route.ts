import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  leads,
  followUps,
  aiEmployees,
  aiBusinessSettings,
} from "@/db/schema";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

import {
  searchKnowledge,
} from "@/lib/knowledge/search";


export async function POST(
  request: Request,
) {

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


    const body =
      await request.json();


    const message =
      String(
        body.message || "",
      ).trim();


    if (!message) {

      return NextResponse.json(
        {
          error:
            "A message is required.",
        },
        {
          status: 400,
        },
      );

    }


    const business = await getCurrentMembership();


    if (!business) {

      return NextResponse.json(
        {
          error:
            "Business not found",
        },
        {
          status: 404,
        },
      );

    }


    const [
      leadsData,
      followUpsData,
      employeesData,
      businessKnowledge,
    ] =
      await Promise.all([

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
          .from(aiEmployees)
          .where(
            eq(
              aiEmployees.businessId,
              business.businessId,
            ),
          ),


        db
          .select()
          .from(aiBusinessSettings)
          .where(
            eq(
              aiBusinessSettings.businessId,
              business.businessId,
            ),
          ),

      ]);


    const overdueFollowUps =
      followUpsData.filter(
        (item) =>
          item.dueAt < new Date() &&
          item.status !== "completed",
      ).length;


    /*
     * Search the business knowledge base.
     *
     * This is intentionally separate from the
     * structured business profile below.
     */

    let knowledgeResults: Awaited<
      ReturnType<typeof searchKnowledge>
    > = [];


    try {

      knowledgeResults =
        await searchKnowledge(
          business.businessId,
          message,
          6,
        );

    } catch (error) {

      console.error(
        "Command center knowledge search error:",
        error,
      );

    }


    const knowledgeContext =
      knowledgeResults.length > 0

        ? knowledgeResults
            .map(
              (item, index) =>
                `[Knowledge ${index + 1}]
Source: ${item.sourceName}
Content:
${item.content}`,
            )
            .join("\n\n")

        : "No matching uploaded business knowledge was found.";


    const knowledge =
      businessKnowledge[0];


    const context = `
You are Kuba, the AI executive assistant
for a business.

Your role is to help the business owner
understand, operate, and improve the company.

IMPORTANT:
Use the business information below as
authoritative structured business context.

Uploaded knowledge is additional business
reference material. Use it when relevant.

Never invent company information.

If the available information does not answer
the question, clearly say that the information
is not currently available.

CURRENT BUSINESS INTELLIGENCE:

BUSINESS PROFILE

Description:
${knowledge?.businessDescription || "Not provided"}

Products and Services:
${knowledge?.productsAndServices || "Not provided"}

Target Customers:
${knowledge?.targetCustomers || "Not provided"}

Frequently Asked Questions:
${knowledge?.frequentlyAskedQuestions || "Not provided"}

Business Instructions:
${knowledge?.aiInstructions || "Not provided"}

Communication Tone:
${knowledge?.tone || "professional"}


AI WORKFORCE

Active AI employees:
${employeesData.length}


SALES

Total sales opportunities:
${leadsData.length}


FOLLOW-UPS

Total follow-ups:
${followUpsData.length}

Overdue follow-ups:
${overdueFollowUps}


UPLOADED BUSINESS KNOWLEDGE

${knowledgeContext}


OWNER QUESTION

${message}


EXECUTIVE RESPONSE RULES

- Answer like an experienced business advisor.
- Use available business facts.
- Use uploaded knowledge when relevant.
- Do not pretend to know information that is unavailable.
- Do not expose internal database details.
- Give practical recommendations when appropriate.
- Keep the response concise and executive-friendly.
- If the owner asks about a specific policy,
  product, process, service, or company rule,
  prefer relevant uploaded knowledge when available.
- If uploaded knowledge conflicts with the
  structured business profile, explain the
  uncertainty rather than silently choosing.
`;


    const result =
      await generateText({

        model:
          openai("gpt-4o-mini"),

        prompt:
          context,

      });


    return NextResponse.json({

      response:
        result.text,

      knowledgeUsed:
        knowledgeResults.length,

    });


  } catch (error) {

    console.error(
      "Command center AI error",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to process request",
      },
      {
        status: 500,
      },
    );

  }

}
