import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";

import {
  businesses,
  aiEmployees,
  aiBusinessSettings,
} from "@/db/schema";

import { kubaAccountantAgent } from "@/mastra/agents/accountant";
import { DEFAULT_CHAT_MODEL_ID } from "@/lib/ai/model-config";
import { classifyAIProviderError } from "@/lib/ai/provider-error";
import { withAIUsageLogging } from "@/lib/ai/usage-logging";

import { searchKnowledge } from "@/lib/knowledge/search";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session?.user) {
      return NextResponse.json({ error: "You must be logged in." }, { status: 401 });
    }

    const body = await request.json();
    const message = String(body.message || "").trim();
    const employeeId = String(body.employeeId || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ error: "Employee ID is required." }, { status: 400 });
    }

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with your account." },
        { status: 404 },
      );
    }

    // Same type-availability policy activation uses (lib/billing/ai-workforce-policy.ts),
    // so runtime entitlement can never disagree with whether this employee
    // was legitimately allowed to be activated in the first place.
    if (!isEmployeeTypeEntitled(await getBusinessEntitlements(business.id), "accountant")) {
      return NextResponse.json(
        {
          error: "Kuba Accountant requires the Pro plan or higher.",
          code: "EMPLOYEE_TYPE_NOT_ENTITLED",
          upgradeRequired: true,
        },
        { status: 403 },
      );
    }

    const employeeResult = await db
      .select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.id, employeeId),
          eq(aiEmployees.businessId, business.id),
          eq(aiEmployees.type, "accountant"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const employee = employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        { error: "This Accountant employee is not active for your business." },
        { status: 404 },
      );
    }

    const businessKnowledgeResult = await db
      .select()
      .from(aiBusinessSettings)
      .where(eq(aiBusinessSettings.businessId, business.id))
      .limit(1);

    const knowledge = businessKnowledgeResult[0];

    // Scoped to this business, so Accountant can never retrieve another
    // company's uploaded documents.
    let knowledgeResults: Awaited<ReturnType<typeof searchKnowledge>> = [];

    try {
      knowledgeResults = await searchKnowledge(business.id, message, 6);
    } catch (error) {
      console.error("Accountant knowledge search error:", error);
    }

    const uploadedKnowledge =
      knowledgeResults.length > 0
        ? knowledgeResults
            .map((item, index) => `[Knowledge ${index + 1}]\nSource: ${item.sourceName}\n\n${item.content}`)
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


ACCOUNTANT EMPLOYEE

Employee name:
${employee.name}

Employee ID:
${employee.id}

Only use information belonging to this business. Never invent financial
records, balances, or transactions. If information is unavailable, say so
clearly.

CURRENT DATE AND TIME

${new Date().toISOString()}
`;

    const prompt = `
${businessContext}


ACCOUNTANT REQUEST

${message}


ACCOUNTANT RESPONSE RULES

- You are not a licensed accountant or tax adviser.
- Only report financial figures returned by your tools.
- Separate facts (from tools) from your own recommendations.
- Do not fabricate missing information.
- The business owner remains the final decision maker.
`;

    const result = await withAIUsageLogging(
      {
        feature: "accountant",
        businessId: business.id,
        employeeId: employee.id,
        model: DEFAULT_CHAT_MODEL_ID,
      },
      () =>
        kubaAccountantAgent.generate(prompt, {
          memory: {
            resource: session.user.id,
            thread: `accountant-${employee.id}`,
          },
          requestContext: new RequestContext([
            ["businessId", business.id],
            ["employeeId", employee.id],
          ]),
        }),
    );

    return NextResponse.json({
      success: true,
      employee: { id: employee.id, name: employee.name },
      response: result.text,
      knowledgeUsed: knowledgeResults.length,
    });
  } catch (error) {
    console.error("Kuba Accountant error:", error, { category: classifyAIProviderError(error) });

    return NextResponse.json({ error: "Kuba Accountant was unable to respond." }, { status: 500 });
  }
}
