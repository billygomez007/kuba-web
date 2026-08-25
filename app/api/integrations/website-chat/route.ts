import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";
import { randomBytes } from "node:crypto";

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
import { runAutomationTrigger } from "@/lib/automations/engine";
import { createAuditLog } from "@/lib/auth/audit";


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

export async function PUT() {
  try {
    const { headers } = await import("next/headers");
    const { auth } = await import("@/lib/auth");
    const {
      getBusinessMembership,
      hasPermission,
      PERMISSIONS,
    } = await import("@/lib/auth/permissions");
    const {
      unauthorizedResponse,
      forbiddenResponse,
    } = await import("@/lib/auth/security");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return unauthorizedResponse();
    }

    const membership =
      await getBusinessMembership(session.user.id);

    if (!membership) {
      return forbiddenResponse();
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.INTEGRATIONS_MANAGE,
      )
    ) {
      return forbiddenResponse();
    }

    const existingResult = await db
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

    const existing = existingResult[0];

    if (
      existing?.status === "active" &&
      existing.publicKey
    ) {
      return NextResponse.json({
        success: true,
        activated: false,
        integration: existing,
      });
    }

    const now = new Date();
    const generatedPublicKey =
      existing?.publicKey ||
      `kuba_pk_${randomBytes(32).toString("base64url")}`;
    const integrationId =
      existing?.id ||
      `website_chat:${membership.businessId}`;

    if (existing) {
      await db
        .update(integrations)
        .set({
          publicKey:
            existing.publicKey ||
            sql<string>`coalesce(${integrations.publicKey}, ${generatedPublicKey})`,
          status: "active",
          updatedAt: now,
        })
        .where(
          and(
            eq(
              integrations.id,
              integrationId,
            ),
            eq(
              integrations.businessId,
              membership.businessId,
            ),
          ),
        );
    } else {
      await db
        .insert(integrations)
        .values({
          id: integrationId,
          businessId:
            membership.businessId,
          provider: "website_chat",
          status: "active",
          publicKey: generatedPublicKey,
          displayName: "Website Chat",
          metadata: JSON.stringify({
            source: "dashboard_activation",
          }),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing({
          target: integrations.id,
        });
    }

    const activatedResult = await db
      .select({
        id: integrations.id,
        publicKey: integrations.publicKey,
        status: integrations.status,
      })
      .from(integrations)
      .where(
        and(
          eq(
            integrations.id,
            integrationId,
          ),
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

    const activatedIntegration =
      activatedResult[0];

    if (!activatedIntegration?.publicKey) {
      throw new Error(
        "Website Chat activation did not persist.",
      );
    }

    const created =
      !existing &&
      activatedIntegration.publicKey ===
        generatedPublicKey;

    if (!existing && !created) {
      return NextResponse.json({
        success: true,
        activated: false,
        integration: activatedIntegration,
      });
    }

    await createAuditLog({
      businessId: membership.businessId,
      userId: session.user.id,
      action:
        "integration.website_chat.activated",
      resource: "integration",
      resourceId: integrationId,
      description:
        "Activated the Website Chat integration.",
      metadata: {
        provider: "website_chat",
        created,
        previousStatus:
          existing?.status ?? null,
      },
    });

    return NextResponse.json({
      success: true,
      activated: true,
      integration: activatedIntegration,
    });
  } catch (error) {
    console.error(
      "Activate Website Chat integration error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to activate Website Chat integration.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  let responseStage =
    "parse_request";

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
    responseStage =
      "resolve_integration";
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
    responseStage =
      "load_business_settings";
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
    responseStage =
      "load_receptionist";
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

      responseStage =
        "create_conversation";
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
    responseStage =
      "save_inbound_message";
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
    responseStage =
      "load_routing";
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
    responseStage =
      "route_conversation";
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
      responseStage =
        "create_routing";
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
      responseStage =
        "update_routing";
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
      responseStage =
        "resolve_routed_employee";
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
      responseStage =
        "search_knowledge";
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
    responseStage =
      "generate_response";
    const response =
      await selectedAgent.generate(
        businessContext,
        {
          requestContext: new RequestContext([["businessId", business.id]]),
        },
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
    responseStage =
      "save_outbound_message";
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

    try {
      await runAutomationTrigger({
        businessId: business.id,
        trigger: "customer.message_received",
        data: {
          conversationId,
          customerName: "Website Visitor",
          message,
          channel: "website",
        },
      });
    } catch (automationError) {
      console.error("Website message automation error:", automationError);
    }

    /**
     * Keep the conversation assigned to the
     * routed AI employee.
     */
    responseStage =
      "update_conversation";
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
        code:
          "WEBSITE_CHAT_RESPONSE_FAILED",
        stage:
          responseStage,
      },
      { status: 500 },
    );
  }
}
