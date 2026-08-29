import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, and, asc } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { searchKnowledge } from "@/lib/knowledge/search";
import { businesses, messages, aiBusinessSettings, aiEmployees, leads, followUps } from "@/db/schema";
import { kubaSalesAgent } from "@/mastra/agents/sales";
import { formatDateTime, getBusinessLocalization } from "@/lib/localization";

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

    const localization = await getBusinessLocalization(business.id);

    const businessKnowledge =
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
      businessKnowledge[0];


    const normalizedMessage = message
      .toLowerCase()
      .replace(/[.!?]+$/g, "")
      .trim();

    /*
     * EXECUTION SAFETY
     *
     * Kuba Sales has no tool that sends a message to a customer
     * directly. Its only customer-contact tool is salesExternalAction,
     * which files a pending row in actionApprovals — a human with
     * approval authority must review and approve it, and a separate
     * execute step actually delivers the message, before anything
     * reaches a real customer.
     *
     * Generic execution requests such as "do it" are allowed to reach
     * the Sales agent, but the agent must never claim a customer was
     * contacted — only that an approval request was created.
     */

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
- Only access leads, follow-ups, and other records belonging to this business.
- Do not ask the user for the Business ID.
- Do not invent a Business ID.

Use this information when answering the user's request.

Do not invent additional business information that is not provided.
If you need more information about the business, ask the user.

CURRENT DATE AND TIME

Business timezone: ${localization.timezone}
Current date and time in the business's timezone: ${formatDateTime(new Date(), localization.timezone, localization.locale)}

When the user uses relative dates such as "today", "tomorrow", "next week", or "Monday", calculate them from the current date and time above, in the business's timezone — never assume UTC or the server's timezone.

Never use a date from your training data or assume a different year.

You are working for the following business:

Use this information when answering the user's request.

Do not invent additional business information that is not provided.
If you need more information about the business, ask the user.

`;

    const salesEmployeeResult = await db
      .select({
        id: aiEmployees.id,
        name: aiEmployees.name,
        type: aiEmployees.type,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.id, employeeId),
          eq(aiEmployees.businessId, business.id),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const salesEmployee = salesEmployeeResult[0];

    if (!salesEmployee) {
      return NextResponse.json(
        { error: "This AI employee is not active for your business." },
        { status: 404 },
      );
    }

    if (salesEmployee.type !== "sales") {
      return NextResponse.json(
        { error: "This employee is not a Sales employee." },
        { status: 400 },
      );
    }

    let workQueueContext = "";

    if (salesEmployee) {
      const assignedLeads = await db
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.businessId, business.id),
            eq(leads.assignedEmployeeId, salesEmployee.id),
          ),
        )
        .orderBy(asc(leads.updatedAt));

      const assignedFollowUps = await db
        .select()
        .from(followUps)
        .where(
          and(
            eq(followUps.businessId, business.id),
            eq(followUps.assignedEmployeeId, salesEmployee.id),
            eq(followUps.status, "pending"),
          ),
        )
        .orderBy(asc(followUps.dueAt));

      workQueueContext = `
SALES WORK QUEUE

Assigned Sales Employee:
${salesEmployee.name}

Assigned Leads:
${JSON.stringify(assignedLeads, null, 2)}

Pending Follow-ups:
${JSON.stringify(assignedFollowUps, null, 2)}

Use this queue as the current source of truth for Sales work.
Never invent leads or follow-ups.
`;
    }

    let knowledgeContext =
      "No matching uploaded Sales knowledge was found.";

    try {
      const knowledge =
        await searchKnowledge(
          business.id,
          message,
          8,
          salesEmployee.id,
        );

      if (knowledge.length > 0) {
        knowledgeContext = knowledge
          .map(
            (item) =>
              `SOURCE: ${item.sourceName}
CHUNK ${item.chunkIndex}

${item.content}`,
          )
          .join("\n\n---\n\n");
      }
    } catch (error) {
      console.error(
        "Sales knowledge search error:",
        error,
      );
    }

    const prompt = `${businessContext}

${workQueueContext}

SALES KNOWLEDGE

${knowledgeContext}

KNOWLEDGE RULES

- Use the Sales knowledge above when it is relevant to the user's request.
- Treat uploaded Sales documents as business-provided information.
- Do not invent figures, customer information, prices, products, or sales results.
- If the uploaded documents do not contain the requested information, say so.
- Distinguish clearly between information from the Sales documents and your own reasoning.

USER REQUEST

${message}`;

 const result = await kubaSalesAgent.generate(prompt, {
  memory: {
    resource: session.user.id,
    thread: `sales-${business.id}`,
  },
  requestContext: new RequestContext([["businessId", business.id]]),
});

    const conversationId = `sales-${salesEmployee.id}`;

    await db.insert(messages).values([
      {
        id: crypto.randomUUID(),
        businessId: business.id,
        conversationId,
        integrationId: "kuba-sales",
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
        integrationId: "kuba-sales",
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
  console.error("Kuba Sales error:", error);
  console.error(
    "Kuba Sales error details:",
    error instanceof Error ? error.message : error,
  );

    return NextResponse.json(
      { error: "Kuba Sales was unable to respond." },
      { status: 500 },
    );
  }
}
