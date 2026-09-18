import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { db } from "@/db";
import {
  aiEmployees,
  conversations,
  conversationRouting,
  messages,
} from "@/db/schema";

import {
  findWhatsAppMessageByExternalId,
  getWhatsAppCredentialsForIntegration,
  resolveWhatsAppIntegrationByPhoneNumberId,
  sendWhatsAppText,
} from "@/lib/channels/whatsapp";

import {
  routeConversationToTeam,
} from "@/lib/communications/team-router";

import type {
  ConversationDepartment,
} from "@/lib/communications/routing";

import {
  kubaReceptionistAgent,
} from "@/mastra/agents/receptionist";

import {
  getKubaAgent,
  type KubaAgentLike,
} from "@/lib/communications/ai-agent-registry";

import {
  getBusinessEntitlements,
} from "@/lib/billing/entitlements";

import {
  isEmployeeImplementationAvailable,
  isEmployeeTypeEntitled,
} from "@/lib/billing/ai-workforce-policy";

import {
  resolveEmployeeForDepartment,
} from "@/lib/communications/handoff";

type ResolvedWhatsAppIntegration =
  NonNullable<
    Awaited<
      ReturnType<
        typeof resolveWhatsAppIntegrationByPhoneNumberId
      >
    >
  >;

export type NormalizedWhatsAppInboundMessage = {
  customerPhone: string;
  externalMessageId: string;
  messageType: string;
  customerMessage: string;
  customerName: string;
  canGenerateAiReply: boolean;
};

export type WhatsAppInboundProcessingResult = {
  status: number;
  body: Record<string, unknown>;
};

/**
 * Provider-independent WhatsApp inbound processing.
 *
 * Meta and WATI must authenticate / validate / normalize their own
 * provider payloads before entering this function.
 *
 * This function never derives tenant ownership from customer-controlled
 * payload fields. `resolved` must already represent the active integration
 * selected by the provider-specific boundary.
 */
export async function processWhatsAppInboundMessage(params: {
  resolved: ResolvedWhatsAppIntegration;
  incomingMessage: NormalizedWhatsAppInboundMessage;
}): Promise<WhatsAppInboundProcessingResult> {
  const {
    resolved,
    incomingMessage,
  } = params;

  const integration =
    resolved.integration;

  const business =
    resolved.business;

  const businessId =
    business.id;

  if (business.status !== "active") {
    return {
      status: 403,
      body: {
        error: "Kuba business is inactive.",
      },
    };
  }

  const customerPhone =
    String(
      incomingMessage.customerPhone || "",
    ).trim();

  const externalMessageId =
    String(
      incomingMessage.externalMessageId || "",
    ).trim();

  const messageType =
    String(
      incomingMessage.messageType || "text",
    ).trim();

  const customerMessage =
    String(
      incomingMessage.customerMessage || "",
    ).trim();

  const customerName =
    String(
      incomingMessage.customerName ||
        customerPhone,
    ).trim();

  const canGenerateAiReply =
    Boolean(
      incomingMessage.canGenerateAiReply,
    );

  if (
    !customerPhone ||
    !externalMessageId
  ) {
    return {
      status: 200,
      body: {
        received: true,
      },
    };
  }

  if (!customerMessage) {
    return {
      status: 200,
      body: {
        received: true,
      },
    };
  }

  /**
   * Prevent duplicate provider webhook delivery.
   *
   * The same provider message ID is only unique inside one
   * integration, so the lookup is tenant/integration scoped.
   */
  const existingMessage =
    await findWhatsAppMessageByExternalId(
      integration.id,
      externalMessageId,
    );

  if (existingMessage) {
    return {
      status: 200,
      body: {
        received: true,
        duplicate: true,
      },
    };
  }

  /**
   * Find the business's active Kuba Receptionist.
   */
  const receptionistResult =
    await db
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
            businessId,
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
    console.error(
      "No active Kuba Receptionist found for business:",
      businessId,
    );

    return {
      status: 404,
      body: {
        error:
          "Kuba Receptionist is not active.",
      },
    };
  }

  /**
   * Find or create the customer's conversation.
   */
  const externalConversationId =
    customerPhone;

  let conversationResult =
    await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(
            conversations.businessId,
            businessId,
          ),
          eq(
            conversations.integrationId,
            integration.id,
          ),
          eq(
            conversations.externalConversationId,
            externalConversationId,
          ),
        ),
      )
      .limit(1);

  let conversation =
    conversationResult[0];

  if (!conversation) {
    const conversationId =
      crypto.randomUUID();

    const now =
      new Date();

    await db
      .insert(conversations)
      .values({
        id: conversationId,
        businessId: businessId,
        integrationId: integration.id,
        externalConversationId,
        customerName,
        customerPhone,
        customerEmail: null,
        assignedEmployeeId:
          receptionist.id,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });

    conversationResult =
      await db
        .select()
        .from(conversations)
        .where(
          eq(
            conversations.id,
            conversationId,
          ),
        )
        .limit(1);

    conversation =
      conversationResult[0];
  }

  if (!conversation) {
    throw new Error(
      "Unable to create or load WhatsApp conversation.",
    );
  }

  /**
   * Existing routing state is preserved as input to the router
   * so a human/team owner is not silently discarded.
   */
  const existingRoutingStateResult =
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
          conversation.id,
        ),
      )
      .limit(1);

  const existingRoutingState =
    existingRoutingStateResult[0];

  const routingDecision =
    await routeConversationToTeam({
      businessId,
      conversationId:
        conversation.id,
      customerId:
        customerPhone,
      channel: "whatsapp",
      message:
        customerMessage,

      currentDepartment:
        typeof existingRoutingState
          ?.department === "string"
          ? (
              existingRoutingState
                .department as
                ConversationDepartment
            )
          : null,

      currentTeamId:
        existingRoutingState
          ?.teamId ?? null,

      currentAiEmployeeId:
        existingRoutingState
          ?.aiEmployeeId ??
        conversation
          .assignedEmployeeId ??
        null,

      currentAssignedUserId:
        existingRoutingState
          ?.assignedUserId ??
        null,
    });

  const existingRouting =
    await db
      .select({
        id:
          conversationRouting.id,
      })
      .from(conversationRouting)
      .where(
        eq(
          conversationRouting
            .conversationId,
          conversation.id,
        ),
      )
      .limit(1);

  if (
    existingRouting.length === 0
  ) {
    const now =
      new Date();

    await db
      .insert(conversationRouting)
      .values({
        id:
          crypto.randomUUID(),

        businessId,

        conversationId:
          conversation.id,

        department:
          routingDecision.department,

        teamId:
          routingDecision.teamId,

        aiEmployeeId:
          routingDecision.aiEmployeeId,

        assignedUserId:
          routingDecision
            .assignedUserId,

        assignmentType:
          routingDecision
            .assignmentType,

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

        assignmentType:
          routingDecision
            .assignmentType,

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
          conversationRouting
            .conversationId,
          conversation.id,
        ),
      );
  }

  /**
   * Persist inbound customer message before any AI action.
   */
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    businessId: businessId,
    conversationId: conversation.id,
    integrationId: integration.id,
    externalMessageId,
    direction: "inbound",
    senderType: "customer",
    senderId: customerPhone,
    content: customerMessage,
    messageType,
    createdAt: new Date(),
  });

  /**
   * Select the AI employee determined by routing.
   *
   * A routed employee may only execute when:
   *  - it belongs to this business,
   *  - it is active,
   *  - the current plan is entitled to it, and
   *  - its runtime is actually implemented.
   */
  let selectedAgent:
    KubaAgentLike =
      kubaReceptionistAgent;

  let selectedEmployeeId =
    receptionist.id;

  let selectedEmployeeType:
    string =
      receptionist.type;

  if (
    routingDecision.aiEmployeeId
  ) {
    const workforceEntitlements =
      await getBusinessEntitlements(
        businessId,
      );

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
              routingDecision
                .aiEmployeeId,
            ),
            eq(
              aiEmployees.businessId,
              businessId,
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

    if (
      routedEmployee &&
      isEmployeeTypeEntitled(
        workforceEntitlements,
        routedEmployee.type,
      ) &&
      isEmployeeImplementationAvailable(
        routedEmployee.type,
      )
    ) {
      selectedEmployeeId =
        routedEmployee.id;

      selectedEmployeeType =
        routedEmployee.type;

      selectedAgent =
        getKubaAgent(
          routedEmployee.type,
        );

      console.log(
        "Kuba routed conversation:",
        {
          conversationId:
            conversation.id,

          department:
            routingDecision
              .department,

          teamId:
            routingDecision
              .teamId,

          aiEmployeeId:
            routedEmployee.id,

          aiEmployeeType:
            routedEmployee.type,
        },
      );
    }
  }

  /**
   * If no team-based AI employee was found, try the same direct
   * department-to-employee fallback used by the production
   * communications stack.
   */
  if (
    selectedEmployeeId ===
      receptionist.id &&
    routingDecision.department
  ) {
    try {
      const directResolution =
        await resolveEmployeeForDepartment({
          businessId,
          department:
            routingDecision
              .department,
          channel:
            "whatsapp",
        });

      if (
        directResolution.ok &&
        directResolution
          .employee.id !==
          receptionist.id
      ) {
        selectedEmployeeId =
          directResolution
            .employee.id;

        selectedEmployeeType =
          directResolution
            .employee.type;

        selectedAgent =
          getKubaAgent(
            directResolution
              .employee.type,
          );

        await db
          .update(
            conversationRouting,
          )
          .set({
            aiEmployeeId:
              directResolution
                .employee.id,

            updatedAt:
              new Date(),
          })
          .where(
            eq(
              conversationRouting
                .conversationId,
              conversation.id,
            ),
          );
      }
    } catch (
      directRoutingError
    ) {
      console.error(
        "WhatsApp direct-type routing error:",
        directRoutingError,
      );
    }
  }

  await db
    .update(conversations)
    .set({
      customerName,
      customerPhone,

      assignedEmployeeId:
        selectedEmployeeId,

      aiMode:
        routingDecision
          .assignmentType === "ai"
          ? "active"
          : "paused",

      status:
        routingDecision.status ===
        "resolved"
          ? "resolved"
          : routingDecision
                .status ===
              "escalated"
            ? "escalated"
            : "open",

      updatedAt:
        new Date(),
    })
    .where(
      eq(
        conversations.id,
        conversation.id,
      ),
    );

  /**
   * HUMAN TAKEOVER / UNSUPPORTED CONTENT GATE.
   *
   * The inbound message has already been stored for the Unified
   * Inbox. AI is forbidden from generating or sending when the
   * router says the conversation belongs to a human/team.
   */
  if (
    !canGenerateAiReply ||
    routingDecision.assignmentType !== "ai"
  ) {
    return {
      status: 200,
      body: {
        received: true,
        success: true,
        aiReplySkipped: true,
      },
    };
  }

  let conversationHistory =
    "No earlier messages in this conversation.";

  try {
    const historyRows =
      await db
        .select({
          direction:
            messages.direction,
          content:
            messages.content,
          createdAt:
            messages.createdAt,
        })
        .from(messages)
        .where(
          and(
            eq(
              messages.conversationId,
              conversation.id,
            ),
            eq(
              messages.businessId,
              businessId,
            ),
          ),
        );

    const priorMessages =
      historyRows
        .filter(
          (row) =>
            row.content,
        )
        .sort(
          (a, b) =>
            a.createdAt.getTime() -
            b.createdAt.getTime(),
        )
        .slice(0, -1);

    if (
      priorMessages.length > 0
    ) {
      conversationHistory =
        priorMessages
          .slice(-10)
          .map(
            (row) =>
              `${
                row.direction ===
                "inbound"
                  ? "Customer"
                  : "Kuba"
              }: ${row.content}`,
          )
          .join("\n");
    }
  } catch (
    historyError
  ) {
    console.error(
      "WhatsApp history load error:",
      historyError,
    );
  }

  const businessContext = `
BUSINESS CONTEXT

You are working for the following business:

Business name: ${business.name}
Industry: ${business.industry || "Not specified"}
Country: ${business.country || "Not specified"}
Business size: ${business.businessSize || "Not specified"}
Business status: ${business.status}

ROUTING

You are the ${selectedEmployeeType} employee for this business (employee ID: ${selectedEmployeeId}).
Department: ${routingDecision.department}
Routing reason: ${routingDecision.reason}

Do not invent information about the business.
If you do not know something, say so and ask for the
information you need.

CUSTOMER

Name: ${customerName}
WhatsApp number: ${customerPhone}

CONVERSATION HISTORY (oldest first — this conversation may have just been
handed to you from another employee; do not ask the customer to repeat
anything already shown here):
${conversationHistory}

CUSTOMER MESSAGE

${customerMessage}
`;

  /**
   * Provider-neutral credential resolution.
   *
   * Meta resolves Meta credentials here.
   * WATI will resolve WATI credentials here once its inbound adapter
   * is connected to this processor.
   */
  const credentials =
    getWhatsAppCredentialsForIntegration(
      integration,
    );

  if (!credentials) {
    console.error(
      "WhatsApp credentials are not configured for business:",
      businessId,
    );

    return {
      status: 500,
      body: {
        error:
          "WhatsApp credentials are not configured.",
      },
    };
  }

  const result =
    await selectedAgent.generate(
      businessContext,
      {
        requestContext:
          new RequestContext([
            [
              "businessId",
              businessId,
            ],
            [
              "employeeId",
              selectedEmployeeId,
            ],
            [
              "conversationId",
              conversation.id,
            ],
            [
              "channel",
              "whatsapp",
            ],
          ]),
      },
    );

  const responseText =
    String(
      result.text || "",
    ).trim();

  if (!responseText) {
    throw new Error(
      "Kuba AI employee returned an empty response.",
    );
  }

  const sendResult =
    await sendWhatsAppText(
      credentials,
      customerPhone,
      responseText,
    );

  if (!sendResult.success) {
    console.error(
      "WhatsApp send error:",
      sendResult.error,
    );

    throw new Error(
      "WhatsApp message could not be sent.",
    );
  }

  /**
   * Save Kuba's provider message ID so delivery/read/failed
   * callbacks can correlate to this exact outbound message.
   */
  await db.insert(messages).values({
    id:
      crypto.randomUUID(),

    businessId:
      businessId,

    conversationId:
      conversation.id,

    integrationId:
      integration.id,

    externalMessageId:
      sendResult.externalMessageId ||
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

  return {
    status: 200,
    body: {
      received: true,
      success: true,
    },
  };
}
