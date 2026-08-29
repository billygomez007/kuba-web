import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  businesses,
  aiEmployees,
  aiBusinessSettings,
} from "@/db/schema";

import { kubaGeneralManagerAgent } from "@/mastra/agents/general-manager";

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
          error:
            "You must be logged in.",
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


    const employeeId =
      String(
        body.employeeId || "",
      ).trim();


    if (!message) {
      return NextResponse.json(
        {
          error:
            "Message is required.",
        },
        {
          status: 400,
        },
      );
    }


    if (!employeeId) {
      return NextResponse.json(
        {
          error:
            "Employee ID is required.",
        },
        {
          status: 400,
        },
      );
    }


    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;


    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        {
          status: 404,
        },
      );
    }


    const employeeResult =
      await db
        .select({
          id:
            aiEmployees.id,

          name:
            aiEmployees.name,

          type:
            aiEmployees.type,

          status:
            aiEmployees.status,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(
              aiEmployees.id,
              employeeId,
            ),

            eq(
              aiEmployees.businessId,
              business.id,
            ),

            eq(
              aiEmployees.type,
              "general-manager",
            ),

            eq(
              aiEmployees.status,
              "active",
            ),
          ),
        )
        .limit(1);


    const employee =
      employeeResult[0];


    if (!employee) {
      return NextResponse.json(
        {
          error:
            "This General Manager is not active for your business.",
        },
        {
          status: 404,
        },
      );
    }


    const businessKnowledgeResult =
      await db
        .select()
        .from(aiBusinessSettings)
        .where(
          eq(
            aiBusinessSettings.businessId,
            business.id,
          ),
        )
        .limit(1);


    const knowledge =
      businessKnowledgeResult[0];


    /*
     * Search uploaded business knowledge.
     *
     * The search is scoped to this business,
     * so the General Manager cannot retrieve
     * another company's documents.
     */

    let knowledgeResults:
      Awaited<
        ReturnType<typeof searchKnowledge>
      > = [];


    try {

      knowledgeResults =
        await searchKnowledge(
          business.id,
          message,
          6,
        );

    } catch (error) {

      console.error(
        "General Manager knowledge search error:",
        error,
      );

    }


    const uploadedKnowledge =
      knowledgeResults.length > 0

        ? knowledgeResults
            .map(
              (item, index) =>
                `[Knowledge ${index + 1}]
Source: ${item.sourceName}

${item.content}`,
            )
            .join("\n\n")

        : "No matching uploaded business knowledge was found.";


    const businessContext = `
BUSINESS CONTEXT

Business name:
${business.name}

Industry:
${business.industry || "Not specified"}

Country:
${business.country || "Not specified"}

Business size:
${business.businessSize || "Not specified"}

Business status:
${business.status}


STRUCTURED BUSINESS KNOWLEDGE

Business Description:
${knowledge?.businessDescription || "Not provided"}

Products and Services:
${knowledge?.productsAndServices || "Not provided"}

Target Customers:
${knowledge?.targetCustomers || "Not provided"}

Frequently Asked Questions:
${knowledge?.frequentlyAskedQuestions || "Not provided"}

AI Instructions:
${knowledge?.aiInstructions || "Not provided"}

Communication Tone:
${knowledge?.tone || "professional"}


UPLOADED BUSINESS KNOWLEDGE

${uploadedKnowledge}


GENERAL MANAGER

Employee name:
${employee.name}

Employee ID:
${employee.id}

You are operating as the General Manager
for this business.

Your responsibilities include:

- Business oversight
- Workforce coordination
- Priority management
- Risk identification
- Executive recommendations
- Management briefings
- Helping the owner understand important
  business information

Only use information belonging to this business.

Never invent business metrics, customers,
revenue, employees, transactions, policies,
or operational events.

If information is unavailable, say so clearly.

If uploaded knowledge is relevant to the
owner's request, use it.

If uploaded knowledge conflicts with structured
business information, do not silently choose
one. Explain the uncertainty.

CURRENT DATE AND TIME

${new Date().toISOString()}
`;


    const prompt = `
${businessContext}


GENERAL MANAGER REQUEST

${message}


GENERAL MANAGER RESPONSE RULES

- Think like a capable business manager.
- Be concise but useful.
- Focus on practical business implications.
- Separate facts from recommendations.
- Do not fabricate missing information.
- Use the business knowledge provided above.
- Use uploaded knowledge when relevant.
- The business owner remains the final decision maker.
`;


    const result =
      await kubaGeneralManagerAgent.generate(
        prompt,
        {
          memory: {
            resource:
              session.user.id,

            thread:
              `general-manager-${employee.id}`,
          },
          requestContext: new RequestContext([["businessId", business.id], ["employeeId", employee.id]]),
        },
      );


    return NextResponse.json({
      success: true,

      employee: {
        id:
          employee.id,

        name:
          employee.name,
      },

      response:
        result.text,

      knowledgeUsed:
        knowledgeResults.length,
    });


  } catch (error) {

    console.error(
      "Kuba General Manager error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Kuba General Manager was unable to respond.",
      },
      {
        status: 500,
      },
    );

  }
}
