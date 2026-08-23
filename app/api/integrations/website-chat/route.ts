import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";

import {
  businesses,
  aiBusinessSettings,
  aiEmployees,
  integrations,
  conversations,
  messages,
  conversationRouting,
} from "@/db/schema";

import { routeConversationToTeam } from "@/lib/communications/team-router";
import { type ConversationDepartment } from "@/lib/communications/routing";
import { getKubaAgent } from "@/lib/communications/ai-agent-registry";
import { searchKnowledge } from "@/lib/knowledge/search";


export async function GET() {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("@/lib/auth");
    const {
      getBusinessMembership,
      hasPermission,
      PERMISSIONS,
    } = await import("@/lib/auth/permissions");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const membership =
      await getBusinessMembership(session.user.id);

    if (!membership) {
      return NextResponse.json(
        { error: "Business access denied." },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.INTEGRATIONS_VIEW,
      )
    ) {
      return NextResponse.json(
        { error: "Permission denied." },
        { status: 403 },
      );
    }

    const result = await db
      .select({
        id: integrations.id,
        publicKey: integrations.publicKey,
        status: integrations.status,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.businessId,
            membership.businessId,
          ),
          eq(
            integrations.provider,
            "website_chat",
          ),
        ),
      )
      .limit(1);

    const integration = result[0];

    if (!integration) {
      return NextResponse.json({
        success: true,
        integration: null,
      });
    }

    return NextResponse.json({
      success: true,
      integration,
    });
  } catch (error) {
    console.error(
      "Load Website Chat integration error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load Website Chat integration.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const publicKey = String(
      body.publicKey || "",
    ).trim();

    const message = String(
      body.message || "",
    ).trim();

    const requestedConversationId =
      typeof body.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    if (!publicKey || !message) {
      return NextResponse.json(
        {
          error:
            "Public key and message are required.",
        },
        { status: 400 },
      );
    }

    if (message.length > 5000) {
      return NextResponse.json(
        {
          error: "Message is too long.",
        },
        { status: 400 },
      );
    }

    /**
     * Resolve the tenant exclusively through
     * the public website integration key.
     */
    const integrationResult = await db
      .select({
        integration: integrations,
        business: businesses,
      })
      .from(integrations)
      .innerJoin(
        businesses,
        eq(
          integrations.businessId,
          businesses.id,
        ),
      )
      .where(
        and(
          eq(
            integrations.publicKey,
            publicKey,
          ),
          eq(
            integrations.provider,
            "website_chat",
          ),
          eq(
            integrations.status,
            "active",
          ),
        ),
      )
      .limit(1);

    const record = integrationResult[0];

    if (!record) {
      return NextResponse.json(
        {
          error:
            "Website integration not found.",
        },
        { status: 404 },
      );
    }

    const integration = record.integration;
    const business = record.business;

    if (business.status !== "active") {
      return NextResponse.json(
        {
          error: "Business is not active.",
        },
        { status: 403 },
      );
    }

    /**
     * Load business-specific AI configuration.
     */
    const settingsResult = await db
      .select()
      .from(aiBusinessSettings)
      .where(
        eq(
          aiBusinessSettings.businessId,
          business.id,
        ),
      )
      .limit(1);

    const settings = settingsResult[0];

    /**
     * Receptionist is the fallback AI employee.
     */
    const receptionistResult = await db
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
            aiEmployees.businessId,
            business.id,
          ),
          eq(
            aiEmployees.type,
            "receptionist",
          ),
          eq(
            aiEmployees.status,
            "active",
          ),
        ),
      )
      .limit(1);

    const receptionist =
      receptionistResult[0];

    if (!receptionist) {
      return NextResponse.json(
        {
          error:
            "Kuba Receptionist is not active.",
        },
        { status: 404 },
      );
    }

    /**
     * Reuse an existing conversation when
     * the website widget supplies its ID.
     */
    let conversationId =
      requestedConversationId;

    if (conversationId) {
      const existingConversation =
        await db
          .select({
            id:
              conversations.id,
          })
          .from(conversations)
          .where(
            and(
              eq(
                conversations.id,
                conversationId,
              ),
              eq(
                conversations.businessId,
                business.id,
              ),
              eq(
                conversations.integrationId,
                integration.id,
              ),
            ),
          )
          .limit(1);

      if (!existingConversation[0]) {
        conversationId = "";
      }
    }

    const now = new Date();

    if (!conversationId) {
      conversationId =
        crypto.randomUUID();

      await db
        .insert(conversations)
        .values({
          id:
            conversationId,

          businessId:
            business.id,

          integrationId:
            integration.id,

          customerName:
            "Website Visitor",

          customerPhone:
            null,

          customerEmail:
            null,

          assignedEmployeeId:
            receptionist.id,

          status:
            "open",

          createdAt:
            now,

          updatedAt:
            now,
        });
    }

    /**
     * Save the incoming visitor message first.
     */
    await db
      .insert(messages)
      .values({
        id:
          crypto.randomUUID(),

        businessId:
          business.id,

        conversationId,

        integrationId:
          integration.id,

        externalMessageId:
          null,

        direction:
          "inbound",

        senderType:
          "customer",

        senderId:
          null,

        content:
          message,

        messageType:
          "text",

        createdAt:
          now,
      });

    /**
     * Read the existing routing state.
     *
     * This allows an existing conversation to remain
     * with its current team unless the router changes it.
     */
    const existingRoutingResult =
      await db
        .select({
          department:
            conversationRouting.department,

          teamId:
            conversationRouting.teamId,

          aiEmployeeId:
            conversationRouting.aiEmployeeId,

          assignedUserId:
            conversationRouting.assignedUserId,
        })
        .from(conversationRouting)
        .where(
          eq(
            conversationRouting.conversationId,
            conversationId,
          ),
        )
        .limit(1);

    const existingRouting =
      existingRoutingResult[0];

    /**
     * Run the central Kuba routing engine.
     */
    const routingDecision =
      await routeConversationToTeam({
        businessId:
          business.id,

        customerId:
          null,

        conversationId,

        channel:
          "website_chat",

        message,

        currentDepartment:
          typeof existingRouting?.department === "string"
            ? existingRouting.department as ConversationDepartment
            : null,

        currentTeamId:
          existingRouting?.teamId ??
          null,

        currentAiEmployeeId:
          existingRouting?.aiEmployeeId ??
          null,

        currentAssignedUserId:
          existingRouting?.assignedUserId ??
          null,
      });

    /**
     * Persist routing state.
     */
    if (!existingRouting) {
      await db
        .insert(conversationRouting)
        .values({
          id:
            crypto.randomUUID(),

          businessId:
            business.id,

          conversationId,

          department:
            routingDecision.department,

          teamId:
            routingDecision.teamId,

          aiEmployeeId:
            routingDecision.aiEmployeeId,

          assignedUserId:
            routingDecision.assignedUserId,

          assignmentType:
            routingDecision.assignmentType,

          status:
            routingDecision.status,

          priority:
            "normal",

          confidence:
            routingDecision.confidence,

          routingReason:
            routingDecision.reason,

          createdAt:
            now,

          updatedAt:
            now,
        });
    } else {
      await db
        .update(conversationRouting)
        .set({
          department:
            routingDecision.department,

          teamId:
            routingDecision.teamId,

          aiEmployeeId:
            routingDecision.aiEmployeeId,

          assignedUserId:
            routingDecision.assignedUserId,

          assignmentType:
            routingDecision.assignmentType,

          status:
            routingDecision.status,

          confidence:
            routingDecision.confidence,

          routingReason:
            routingDecision.reason,

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            conversationRouting.conversationId,
            conversationId,
          ),
        );
    }

    /**
     * Select the routed AI employee.
     *
     * Receptionist remains the fallback if the
     * routing engine has not found an AI employee.
     */
    let selectedEmployeeId =
      receptionist.id;

    let selectedAgent =
      getKubaAgent(
        receptionist.type,
      );

    if (
      routingDecision.aiEmployeeId
    ) {
      const routedEmployeeResult =
        await db
          .select({
            id:
              aiEmployees.id,

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
                routingDecision.aiEmployeeId,
              ),

              eq(
                aiEmployees.businessId,
                business.id,
              ),

              eq(
                aiEmployees.status,
                "active",
              ),
            ),
          )
          .limit(1);

      const routedEmployee =
        routedEmployeeResult[0];

      if (routedEmployee) {
        selectedEmployeeId =
          routedEmployee.id;

        selectedAgent =
          getKubaAgent(
            routedEmployee.type,
          );
      }
    }

    /**
     * Retrieve relevant uploaded business knowledge.
     *
     * This supplements the structured business profile with
     * information from uploaded documents and knowledge sources.
     */
    let knowledgeContext = "";

    try {
      const knowledgeResults =
        await searchKnowledge(
          business.id,
          message,
          5,
        );

      if (knowledgeResults.length > 0) {
        knowledgeContext = knowledgeResults
          .map((item, index) => {
            return `
KNOWLEDGE SOURCE ${index + 1}

${item.content}
`;
          })
          .join("\n");
      }
    } catch (knowledgeError) {
      console.error(
        "Website Chat knowledge search error:",
        knowledgeError,
      );
    }

    /**
     * Build business context.
     */
    const businessContext = `
You are Kuba AI working for this specific business.

BUSINESS

Business name:
${business.name}

Industry:
${business.industry || ""}

Country:
${business.country || ""}

Business size:
${business.businessSize || ""}

Business description:
${settings?.businessDescription || ""}

Products and services:
${settings?.productsAndServices || ""}

Target customers:
${settings?.targetCustomers || ""}

Frequently asked questions:
${settings?.frequentlyAskedQuestions || ""}

Additional AI instructions:
${settings?.aiInstructions || ""}

Tone:
${settings?.tone || "professional"}

UPLOADED BUSINESS KNOWLEDGE

${knowledgeContext || "No relevant uploaded knowledge was found."}

ROUTING

Department:
${routingDecision.department}

Team:
${routingDecision.teamId || "No specific team"}

AI employee:
${selectedEmployeeId}

ROUTING REASON:
${routingDecision.reason}

CUSTOMER MESSAGE:
${message}

INSTRUCTIONS

Respond as the selected Kuba AI employee for this business.
Do not claim to represent another business.
Do not invent business information.
If the business information does not contain the answer,
say so clearly and ask for the information needed.
Answer naturally, helpfully and professionally.
`;

    /**
     * Generate the AI response.
     */
    const response =
      await selectedAgent.generate(
        businessContext,
      );

    const responseText =
      String(
        response.text || "",
      ).trim();

    if (!responseText) {
      throw new Error(
        "Kuba AI employee returned an empty response.",
      );
    }

    /**
     * Save Kuba's response.
     */
    await db
      .insert(messages)
      .values({
        id:
          crypto.randomUUID(),

        businessId:
          business.id,

        conversationId,

        integrationId:
          integration.id,

        externalMessageId:
          null,

        direction:
          "outbound",

        senderType:
          "ai_employee",

        senderId:
          selectedEmployeeId,

        content:
          responseText,

        messageType:
          "text",

        createdAt:
          new Date(),
      });

    /**
     * Keep the conversation assigned to the
     * routed AI employee.
     */
    await db
      .update(conversations)
      .set({
        customerName:
          "Website Visitor",

        assignedEmployeeId:
          selectedEmployeeId,

        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            conversations.id,
            conversationId,
          ),

          eq(
            conversations.businessId,
            business.id,
          ),
        ),
      );

    return NextResponse.json({
      success:
        true,

      response:
        responseText,

      conversationId,

      routing: {
        department:
          routingDecision.department,

        teamId:
          routingDecision.teamId,

        aiEmployeeId:
          selectedEmployeeId,

        assignmentType:
          routingDecision.assignmentType,

        confidence:
          routingDecision.confidence,
      },
    });
  } catch (error) {
    console.error(
      "Website chat error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to respond.",
      },
      { status: 500 },
    );
  }
}
