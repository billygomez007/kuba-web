import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businesses,
  businessUsers,
  aiEmployees,
  aiBusinessSettings,
} from "@/db/schema";

import { kubaCustomerSupportAgent } from "@/mastra/agents/customer-support";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const body = await request.json();

    const message = String(body.message || "").trim();
    const employeeId = String(body.employeeId || "").trim();

    if (!message) {
      return NextResponse.json(
        { error: "Message is required." },
        { status: 400 },
      );
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: "Employee ID is required." },
        { status: 400 },
      );
    }

    const businessResult = await db
      .select({
        business: businesses,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(
          businessUsers.businessId,
          businesses.id,
        ),
      )
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);

    const business = businessResult[0]?.business;

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        { status: 404 },
      );
    }

    const employeeResult = await db
      .select({
        id: aiEmployees.id,
        name: aiEmployees.name,
        type: aiEmployees.type,
        status: aiEmployees.status,
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
            "customer-support",
          ),
          eq(
            aiEmployees.status,
            "active",
          ),
        ),
      )
      .limit(1);

    const employee = employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "This Customer Support employee is not active for your business.",
        },
        { status: 404 },
      );
    }

    const businessKnowledgeResult = await db
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

    const businessContext = `
BUSINESS CONTEXT

Business ID: ${business.id}
Business name: ${business.name}
Industry: ${business.industry || "Not specified"}
Country: ${business.country || "Not specified"}
Business size: ${business.businessSize || "Not specified"}
Business status: ${business.status}

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

IMPORTANT:

- You are working specifically as ${employee.name}.
- Employee ID: ${employee.id}
- Only work within this business.
- Never invent business information.
- Never invent customer records.
- Never claim an action was completed unless a tool actually completed it.

CURRENT DATE AND TIME

${new Date().toISOString()}
`;

    const prompt = `
${businessContext}

CUSTOMER SUPPORT REQUEST

${message}
`;

    const result =
      await kubaCustomerSupportAgent.generate(
        prompt,
        {
          memory: {
            resource: session.user.id,
            thread: `customer-support-${employee.id}`,
          },
          requestContext: new RequestContext([["businessId", business.id]]),
        },
      );

    return NextResponse.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
      },
      response: result.text,
    });

  } catch (error) {
    console.error(
      "Kuba Customer Support error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Kuba Customer Support was unable to respond.",
      },
      { status: 500 },
    );
  }
}
