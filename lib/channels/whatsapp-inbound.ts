import crypto from "crypto";
import { and, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { db } from "@/db";
import {
  aiEmployees,
  conversations,
  conversationRouting,
  integrations,
  messages,
} from "@/db/schema";
import {
  findWhatsAppMessageByExternalId,
  getWhatsAppCredentialsForIntegration,
  sendWhatsAppText,
} from "@/lib/channels/whatsapp";
import { routeConversationToTeam } from "@/lib/communications/team-router";
import type { ConversationDepartment } from "@/lib/communications/routing";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { getKubaAgent } from "@/lib/communications/ai-agent-registry";

export type NormalizedWhatsAppInboundMessage = {
  customerPhone: string;
  externalMessageId: string;
  messageType: string;
  customerMessage: string;
  customerName: string;
  canGenerateAiReply: boolean;
};

export type NormalizedWhatsAppStatusUpdate = {
  externalMessageId: string;
  status: string;
};

type ResolvedWhatsAppIntegration = Awaited<
  ReturnType<
    typeof import("@/lib/channels/whatsapp").resolveWhatsAppIntegrationByPhoneNumberId
  >
>;

export async function processWhatsAppInbound(params: {
  resolved: NonNullable<ResolvedWhatsAppIntegration>;
  statusUpdates?: NormalizedWhatsAppStatusUpdate[];
  incomingMessage?: NormalizedWhatsAppInboundMessage | null;
}) {
  const { resolved } = params;
  const integration = resolved.integration;
  const business = resolved.business;
  const businessId = business.id;

  if (business.status !== "active") {
    return {
      status: 403,
      body: { error: "Kuba business is inactive." },
    };
  }

  await db
    .update(integrations)
    .set({ lastWebhookAt: new Date() })
    .where(eq(integrations.id, integration.id));

  for (const statusUpdate of params.statusUpdates || []) {
    const externalId = String(
      statusUpdate.externalMessageId || "",
    ).trim();
    const status = String(statusUpdate.status || "").trim();

    if (!externalId || !status) {
      continue;
    }

    await db
      .update(messages)
      .set({ status, statusUpdatedAt: new Date() })
      .where(
        and(
          eq(messages.integrationId, integration.id),
          eq(messages.externalMessageId, externalId),
        ),
      );
  }

  const incoming = params.incomingMessage;

  if (!incoming) {
    return {
      status: 200,
      body: { received: true },
    };
  }

  const customerPhone = String(incoming.customerPhone || "").trim();
  const externalMessageId = String(
    incoming.externalMessageId || "",
  ).trim();
  const messageType = String(incoming.messageType || "text");
  const customerMessage = String(
    incoming.customerMessage || "",
  ).trim();
  const customerName =
    String(incoming.customerName || "").trim() || customerPhone;

  if (
    !customerPhone ||
    !externalMessageId ||
    !customerMessage
  ) {
    return {
      status: 200,
      body: { received: true },
    };
  }

  const existingMessage =
    await findWhatsAppMessageByExternalId(
      integration.id,
      externalMessageId,
    );

  if (existingMessage) {
    return {
      status: 200,
      body: { received: true, duplicate: true },
    };
  }

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
        eq(aiEmployees.businessId, businessId),
        eq(aiEmployees.type, "receptionist"),
        eq(aiEmployees.status, "active"),
      ),
    )
    .limit(1);

  const receptionist = receptionistResult[0];

  if (!receptionist) {
    return {
      status: 404,
      body: { error: "Kuba Receptionist is not active." },
    };
  }

  const externalConversationId = customerPhone;

  let conversationResult = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.businessId, businessId),
        eq(conversations.integrationId, integration.id),
        eq(
          conversations.externalConversationId,
          externalConversationId,
        ),
      ),
    )
    .limit(1);

  let conversation = conversationResult[0];

  if (!conversation) {
    const conversationId = crypto.randomUUID();
    const now = new Date();

    await db.insert(conversations).values({
      id: conversationId,
      businessId,
      integrationId: integration.id,
      externalConversationId,
      customerName,
      customerPhone,
      customerEmail: null,
      assignedEmployeeId: receptionist.id,
      status: "open",
      createdAt: now,
      updatedAt: now,
    });

    conversationResult = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    conversation = conversationResult[0];
  }

  if (!conversation) {
    throw new Error(
      "Unable to create or load WhatsApp conversation.",
    );
  }

  const existingRoutingStateResult = await db
    .select({
      department: conversationRouting.department,
      teamId: conversationRouting.teamId,
      aiEmployeeId: conversationRouting.aiEmployeeId,
      assignedUserId: conversationRouting.assignedUserId,
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
      conversationId: conversation.id,
      customerId: customerPhone,
      channel: "whatsapp",
      message: customerMessage,
      currentDepartment:
        typeof existingRoutingState?.department === "string"
          ? (
              existingRoutingState.department as
                ConversationDepartment
            )
          : null,
      currentTeamId:
        existingRoutingState?.teamId ?? null,
      currentAiEmployeeId:
        existingRoutingState?.aiEmployeeId ??
        conversation.assignedEmployeeId ??
        null,
      currentAssignedUserId:
        existingRoutingState?.assignedUserId ?? null,
    });

  const existingRouting = await db
    .select({ id: conversationRouting.id })
    .from(conversationRouting)
    .where(
      eq(
        conversationRouting.conversationId,
        conversation.id,
      ),
    )
    .limit(1);

  if (existingRouting.length === 0) {
    const now = new Date();

    await db.insert(conversationRouting).values({
      id: crypto.randomUUID(),
      businessId,
      conversationId: conversation.id,
      department: routingDecision.department,
      teamId: routingDecision.teamId,
      aiEmployeeId: routingDecision.aiEmployeeId,
      assignedUserId: routingDecision.assignedUserId,
      assignmentType: routingDecision.assignmentType,
      status: routingDecision.status,
      priority: "normal",
      confidence: routingDecision.confidence,
      routingReason: routingDecision.reason,
      createdAt: now,
      updatedAt: now,
    });
  } else {
    await db
      .update(conversationRouting)
      .set({
        department: routingDecision.department,
        teamId: routingDecision.teamId,
        aiEmployeeId: routingDecision.aiEmployeeId,
        assignmentType: routingDecision.assignmentType,
        status: routingDecision.status,
        confidence: routingDecision.confidence,
        routingReason: routingDecision.reason,
        updatedAt: new Date(),
      })
      .where(
        eq(
          conversationRouting.conversationId,
          conversation.id,
        ),
      );
  }

  await db.insert(messages).values({
    id: crypto.randomUUID(),
    businessId,
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

  let selectedAgent: {
    generate: (
      input: string,
      options?: { requestContext?: RequestContext },
    ) => Promise<{ text?: string }>;
  } = kubaReceptionistAgent;

  let selectedEmployeeId = receptionist.id;

  if (routingDecision.aiEmployeeId) {
    const routedEmployeeResult = await db
      .select({
        id: aiEmployees.id,
        type: aiEmployees.type,
        status: aiEmployees.status,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(
            aiEmployees.id,
            routingDecision.aiEmployeeId,
          ),
          eq(aiEmployees.businessId, businessId),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const routedEmployee = routedEmployeeResult[0];

    if (routedEmployee) {
      selectedEmployeeId = routedEmployee.id;
      selectedAgent = getKubaAgent(routedEmployee.type);
    }
  }

  await db
    .update(conversations)
    .set({
      customerName,
      customerPhone,
      assignedEmployeeId: selectedEmployeeId,
      aiMode:
        routingDecision.assignmentType === "ai"
          ? "active"
          : "paused",
      status:
        routingDecision.status === "resolved"
          ? "resolved"
          : routingDecision.status === "escalated"
            ? "escalated"
            : "open",
      updatedAt: new Date(),
    })
    .where(eq(conversations.id, conversation.id));

  if (
    !incoming.canGenerateAiReply ||
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

  const businessContext = `
BUSINESS CONTEXT

You are working for the following business:

Business name: ${business.name}
Industry: ${business.industry || "Not specified"}
Country: ${business.country || "Not specified"}
Business size: ${business.businessSize || "Not specified"}
Business status: ${business.status}

You are Kuba Receptionist.

Your job is to welcome customers, answer common questions,
capture useful information, understand customer needs,
and route qualified opportunities to Kuba Sales.

Do not invent information about the business.
If you do not know something, say so and ask for the
information you need.

CUSTOMER

Name: ${customerName}
WhatsApp number: ${customerPhone}

CUSTOMER MESSAGE

${customerMessage}
`;

  const credentials =
    getWhatsAppCredentialsForIntegration(integration);

  if (!credentials) {
    return {
      status: 500,
      body: {
        error:
          "WhatsApp credentials are not configured.",
      },
    };
  }

  const result = await selectedAgent.generate(
    businessContext,
    {
      requestContext: new RequestContext([
        ["businessId", businessId],
        ["employeeId", selectedEmployeeId],
      ]),
    },
  );

  const responseText = String(result.text || "").trim();

  if (!responseText) {
    throw new Error(
      "Kuba AI employee returned an empty response.",
    );
  }

  const sendResult = await sendWhatsAppText(
    credentials,
    customerPhone,
    responseText,
  );

  if (!sendResult.success) {
    throw new Error(
      "WhatsApp message could not be sent.",
    );
  }

  await db.insert(messages).values({
    id: crypto.randomUUID(),
    businessId,
    conversationId: conversation.id,
    integrationId: integration.id,
    externalMessageId:
      sendResult.externalMessageId || null,
    direction: "outbound",
    senderType: "ai_employee",
    senderId: selectedEmployeeId,
    content: responseText,
    messageType: "text",
    createdAt: new Date(),
  });

  return {
    status: 200,
    body: {
      received: true,
      success: true,
    },
  };
}
