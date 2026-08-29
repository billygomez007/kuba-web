import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { searchKnowledge } from "@/lib/knowledge/search";
import { businesses, businessUsers, messages, aiBusinessSettings, aiEmployees, leads, actionApprovals } from "@/db/schema";
import { kubaMarketingAgent } from "@/mastra/agents/marketing";

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
      .select({ business: businesses })
      .from(businessUsers)
      .innerJoin(businesses, eq(businessUsers.businessId, businesses.id))
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const business = businessResult[0]?.business;

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with your account." },
        { status: 404 },
      );
    }

    const marketingEmployeeResult = await db
      .select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.id, employeeId),
          eq(aiEmployees.businessId, business.id),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const marketingEmployee = marketingEmployeeResult[0];

    if (!marketingEmployee) {
      return NextResponse.json(
        { error: "This AI employee is not active for your business." },
        { status: 404 },
      );
    }

    if (marketingEmployee.type !== "marketing") {
      return NextResponse.json(
        { error: "This employee is not a Marketing employee." },
        { status: 400 },
      );
    }

    const businessKnowledge = await db
      .select()
      .from(aiBusinessSettings)
      .where(eq(aiBusinessSettings.businessId, business.id))
      .limit(1);

    const knowledge = businessKnowledge[0];

    const businessContext = `
BUSINESS CONTEXT

You are working for the following business:

Business ID: ${business.id}
Business name: ${business.name}
Industry: ${business.industry || "Not specified"}
Country: ${business.country || "Not specified"}
Business size: ${business.businessSize || "Not specified"}
Business status: ${business.status}

Business Profile:

Description:
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
- Use the Business ID above when calling tools that require businessId.
- Only access leads, customers, and other records belonging to this business.
- Do not ask the user for the Business ID.
- Do not invent a Business ID.

CURRENT DATE AND TIME

Current date: ${new Date().toISOString()}

When the user uses relative dates such as "today", "tomorrow", "next week", or "Monday", calculate them from the current date and time above. Never use a date from your training data or assume a different year.
`;

    const [openLeads, pendingApprovals] = await Promise.all([
      db
        .select({ id: leads.id, name: leads.name, stage: leads.stage, service: leads.service })
        .from(leads)
        .where(eq(leads.businessId, business.id)),
      db
        .select({ id: actionApprovals.id, channel: actionApprovals.channel })
        .from(actionApprovals)
        .where(and(eq(actionApprovals.businessId, business.id), eq(actionApprovals.status, "pending"))),
    ]);

    const pipelineContext = `
MARKETING WORK CONTEXT

Open leads: ${openLeads.length}
Pending approvals waiting on marketing external actions: ${pendingApprovals.length}

Use the getGrowthOpportunities, getLeads, getCustomerSummary, and getPendingMarketingApprovals tools for the actual records — the counts above are only a quick orientation, not a source of truth for individual leads.
`;

    let knowledgeContext = "No matching uploaded Marketing knowledge was found.";

    try {
      const knowledgeChunks = await searchKnowledge(business.id, message, 8, marketingEmployee.id);

      if (knowledgeChunks.length > 0) {
        knowledgeContext = knowledgeChunks
          .map((item) => `SOURCE: ${item.sourceName}\nCHUNK ${item.chunkIndex}\n\n${item.content}`)
          .join("\n\n---\n\n");
      }
    } catch (error) {
      console.error("Marketing knowledge search error:", error);
    }

    const prompt = `${businessContext}

${pipelineContext}

MARKETING KNOWLEDGE

${knowledgeContext}

KNOWLEDGE RULES

- Use the Marketing knowledge above when it is relevant to the user's request.
- Treat uploaded Marketing documents as business-provided information.
- Do not invent figures, customer information, prices, products, or campaign results.
- If the uploaded documents do not contain the requested information, say so.
- Distinguish clearly between information from the Marketing documents and your own reasoning.

USER REQUEST

${message}`;

    const result = await kubaMarketingAgent.generate(prompt, {
      memory: {
        resource: session.user.id,
        thread: `marketing-${business.id}`,
      },
      requestContext: new RequestContext([["businessId", business.id]]),
    });

    const conversationId = `marketing-${marketingEmployee.id}`;

    await db.insert(messages).values([
      {
        id: crypto.randomUUID(),
        businessId: business.id,
        conversationId,
        integrationId: "kuba-marketing",
        externalMessageId: null,
        direction: "inbound",
        senderType: "user",
        senderId: session.user.id,
        content: message,
        messageType: "text",
        createdAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        businessId: business.id,
        conversationId,
        integrationId: "kuba-marketing",
        externalMessageId: null,
        direction: "outbound",
        senderType: "assistant",
        senderId: null,
        content: result.text,
        messageType: "text",
        createdAt: new Date(),
      },
    ]);

    return NextResponse.json({
      success: true,
      response: result.text,
    });
  } catch (error) {
    console.error("Kuba Marketing error:", error);
    console.error("Kuba Marketing error details:", error instanceof Error ? error.message : error);

    return NextResponse.json(
      { error: "Kuba Marketing was unable to respond." },
      { status: 500 },
    );
  }
}
