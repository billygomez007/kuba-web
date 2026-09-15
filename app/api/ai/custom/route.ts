import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, like } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";

import {
  businesses,
  aiEmployees,
  aiEmployeeSettings,
  aiEmployeeScopes,
  aiBusinessSettings,
} from "@/db/schema";

import { buildCustomAgentTools, createCustomAgent, toolIdFromScope } from "@/mastra/agents/custom";
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
    if (!isEmployeeTypeEntitled(await getBusinessEntitlements(business.id), "custom")) {
      return NextResponse.json(
        {
          error: "Custom AI employees require the Pro plan or higher.",
          code: "EMPLOYEE_TYPE_NOT_ENTITLED",
          upgradeRequired: true,
        },
        { status: 403 },
      );
    }

    const employeeResult = await db
      .select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status, description: aiEmployees.description })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.id, employeeId),
          eq(aiEmployees.businessId, business.id),
          eq(aiEmployees.type, "custom"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const employee = employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        { error: "This Custom employee is not active for your business." },
        { status: 404 },
      );
    }

    const settingsResult = await db
      .select({ roleInstructions: aiEmployeeSettings.roleInstructions, goals: aiEmployeeSettings.goals })
      .from(aiEmployeeSettings)
      .where(eq(aiEmployeeSettings.employeeId, employee.id))
      .limit(1);

    const settings = settingsResult[0];

    // The platform's ceiling on what this employee can do: only tools this
    // business has explicitly granted, resolved fresh from the database —
    // never trusted from the client, never the full catalog by default.
    const grantedScopeRows = await db
      .select({ scope: aiEmployeeScopes.scope })
      .from(aiEmployeeScopes)
      .where(
        and(
          eq(aiEmployeeScopes.businessId, business.id),
          eq(aiEmployeeScopes.aiEmployeeId, employee.id),
          eq(aiEmployeeScopes.effect, "allow"),
          eq(aiEmployeeScopes.status, "active"),
          like(aiEmployeeScopes.scope, "tool:%"),
        ),
      );

    const grantedToolIds = grantedScopeRows
      .map((row) => toolIdFromScope(row.scope))
      .filter((id): id is string => Boolean(id));

    const tools = buildCustomAgentTools(grantedToolIds);

    const businessKnowledgeResult = await db
      .select()
      .from(aiBusinessSettings)
      .where(eq(aiBusinessSettings.businessId, business.id))
      .limit(1);

    const knowledge = businessKnowledgeResult[0];

    // Scoped to this business, so a Custom employee can never retrieve
    // another company's uploaded documents.
    let knowledgeResults: Awaited<ReturnType<typeof searchKnowledge>> = [];

    try {
      knowledgeResults = await searchKnowledge(business.id, message, 6);
    } catch (error) {
      console.error("Custom employee knowledge search error:", error);
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

Only use information belonging to this business. Never invent business
information. If information is unavailable, say so clearly.

CURRENT DATE AND TIME

${new Date().toISOString()}
`;

    const prompt = `
${businessContext}


REQUEST

${message}


RESPONSE RULES

- Only use the tools you have actually been given.
- Only report facts your tools actually return.
- Do not fabricate missing information.
- The business owner remains the final decision maker.
`;

    const agent = createCustomAgent({
      employeeId: employee.id,
      employeeName: employee.name,
      roleTitle: employee.description,
      objective: settings?.goals ?? null,
      customInstructions: settings?.roleInstructions ?? null,
      tools,
    });

    const result = await withAIUsageLogging(
      {
        feature: "custom",
        businessId: business.id,
        employeeId: employee.id,
        model: DEFAULT_CHAT_MODEL_ID,
      },
      () =>
        agent.generate(prompt, {
          memory: {
            resource: session.user.id,
            thread: `custom-${employee.id}`,
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
      toolsGranted: grantedToolIds.length,
    });
  } catch (error) {
    console.error("Custom employee error:", error, { category: classifyAIProviderError(error) });

    return NextResponse.json({ error: "This AI employee was unable to respond." }, { status: 500 });
  }
}
