import { NextResponse } from "next/server";
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
  routeConversationToTeam,
} from "@/lib/communications/team-router";
import type { ConversationDepartment } from "@/lib/communications/routing";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { getKubaAgent } from "@/lib/communications/ai-agent-registry";
import { safeCompareSecret } from "@/lib/auth/security";
import {
  findWhatsAppMessageByExternalId,
  getWhatsAppCredentialsForIntegration,
  resolveWhatsAppIntegrationByPhoneNumberId,
  sendWhatsAppText,
} from "@/lib/channels/whatsapp";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;


function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
) {
  const appSecret =
    process.env.WHATSAPP_APP_SECRET;

  if (!appSecret || !signatureHeader) {
    return false;
  }

  const expected =
    "sha256=" +
    crypto
      .createHmac(
        "sha256",
        appSecret,
      )
      .update(rawBody)
      .digest("hex");

  const expectedBuffer =
    Buffer.from(expected);

  const receivedBuffer =
    Buffer.from(signatureHeader);

  if (
    expectedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expectedBuffer,
    receivedBuffer,
  );
}

/**
 * Meta webhook verification
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (
    mode === "subscribe" &&
    safeCompareSecret(token, VERIFY_TOKEN)
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * Receive WhatsApp messages from Meta
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    const signature =
      request.headers.get(
        "x-hub-signature-256",
      );

    if (!verifyMetaSignature(rawBody, signature)) {
      console.error(
        "Invalid WhatsApp webhook signature.",
      );

      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 },
      );
    }

    const body =
      JSON.parse(rawBody);

    console.log("WhatsApp webhook received.");

    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true });
    }

    const value = body.entry?.[0]?.changes?.[0]?.value;

    if (!value) {
      return NextResponse.json({ received: true });
    }

    const incomingPhoneNumberId =
      value.metadata?.phone_number_id || PHONE_NUMBER_ID;

    if (!incomingPhoneNumberId) {
      console.error(
        "WhatsApp phone number ID is missing.",
      );

      return NextResponse.json(
        {
          error:
            "WhatsApp phone number is not configured.",
        },
        { status: 400 },
      );
    }

    /**
     * Resolve the tenant exclusively from the
     * registered WhatsApp phone number.
     *
     * Never trust a business ID supplied by the
     * webhook request or environment variables.
     */
    const resolved =
      await resolveWhatsAppIntegrationByPhoneNumberId(
        incomingPhoneNumberId,
      );

    if (!resolved) {
      console.error(
        "Unregistered WhatsApp phone number:",
        incomingPhoneNumberId,
      );

      return NextResponse.json(
        {
          error:
            "WhatsApp number is not registered with Kuba.",
        },
        { status: 404 },
      );
    }

    const integration =
      resolved.integration;

    const business =
      resolved.business;

    const businessId =
      business.id;

    if (
      business.status !==
      "active"
    ) {
      console.error(
        "WhatsApp business is inactive:",
        businessId,
      );

      return NextResponse.json(
        {
          error:
            "Kuba business is inactive.",
        },
        { status: 403 },
      );
    }

    /**
     * Connection-health signal: a signature-verified webhook for a known,
     * active tenant proves this integration is genuinely receiving Meta
     * traffic, independent of whatever the payload actually contains.
     */
    await db
      .update(integrations)
      .set({ lastWebhookAt: new Date() })
      .where(eq(integrations.id, integration.id));

    /**
     * Message status callbacks (sent/delivered/read/failed).
     *
     * Meta reports delivery status for messages Kuba sent through this
     * same webhook endpoint, keyed by the outbound message's external id.
     */
    if (Array.isArray(value.statuses) && value.statuses.length > 0) {
      for (const statusUpdate of value.statuses) {
        const statusExternalId = String(statusUpdate?.id || "").trim();
        const status = String(statusUpdate?.status || "").trim();

        if (!statusExternalId || !status) {
          continue;
        }

        await db
          .update(messages)
          .set({
            status,
            statusUpdatedAt: new Date(),
          })
          .where(
            and(
              eq(messages.integrationId, integration.id),
              eq(messages.externalMessageId, statusExternalId),
            ),
          );
      }

      return NextResponse.json({ received: true });
    }

    const incomingMessage = value.messages?.[0];

    if (!incomingMessage) {
      return NextResponse.json({ received: true });
    }

    const customerPhone = String(incomingMessage.from || "").trim();
    const externalMessageId = String(incomingMessage.id || "").trim();
    const messageType = String(incomingMessage.type || "text");

    if (!customerPhone || !externalMessageId) {
      return NextResponse.json({ received: true });
    }

    /**
     * Only plain text messages can be handed to the AI as if they were a
     * real customer request. Every other message type is still stored for
     * the Unified Inbox — a human can view/handle it — but is never fed to
     * the AI as text, and never generates an AI reply.
     */
    const canGenerateAiReply = messageType === "text";

    const customerMessage =
      messageType === "text"
        ? String(incomingMessage.text?.body || "").trim()
        : "Viewing this content type is not yet supported.";

    if (canGenerateAiReply && !customerMessage) {
      return NextResponse.json({ received: true });
    }

    const customerName =
      value.contacts?.[0]?.profile?.name ||
      customerPhone;

    /**
     * Find Kuba Receptionist.
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
          eq(aiEmployees.businessId, businessId),
          eq(aiEmployees.type, "receptionist"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    const receptionist = receptionistResult[0];

    if (!receptionist) {
      console.error(
        "No active Kuba Receptionist found for business:",
        businessId,
      );

      return NextResponse.json(
        { error: "Kuba Receptionist is not active." },
        { status: 404 },
      );
    }

    /**
     * Find or create the customer conversation.
     */
    const externalConversationId = customerPhone;

    let conversationResult = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.businessId, businessId),
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

    let conversation = conversationResult[0];

    if (!conversation) {
      const conversationId = crypto.randomUUID();
      const now = new Date();

      await db.insert(conversations).values({
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

    /**
     * Read the existing routing state.
     *
     * This allows an existing conversation to remain
     * with its current team/human owner unless the
     * router explicitly changes it.
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

    /**
     * Route the conversation through Kuba's
     * department and team routing engine.
     *
     * Reception remains the initial AI handler,
     * but the routing decision is stored separately
     * so the conversation can move between teams
     * without changing the underlying WhatsApp number.
     */
    const routingDecision =
      await routeConversationToTeam({
        businessId,

        conversationId:
          conversation.id,

        customerId:
          customerPhone,

        channel:
          "whatsapp",

        message:
          customerMessage,

        currentDepartment:
          typeof existingRoutingState?.department === "string"
            ? existingRoutingState.department as ConversationDepartment
            : null,

        currentTeamId:
          existingRoutingState?.teamId ??
          null,

        currentAiEmployeeId:
          existingRoutingState?.aiEmployeeId ??
          conversation.assignedEmployeeId ??
          null,

        currentAssignedUserId:
          existingRoutingState?.assignedUserId ??
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
            conversationRouting.conversationId,
            conversation.id,
          ),
        )
        .limit(1);

    if (existingRouting.length === 0) {
      const now = new Date();

      await db.insert(
        conversationRouting,
      ).values({
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
        .update(
          conversationRouting,
        )
        .set({
          department:
            routingDecision.department,

          teamId:
            routingDecision.teamId,

          aiEmployeeId:
            routingDecision.aiEmployeeId,

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
            conversation.id,
          ),
        );
    }

    /**
     * Prevent duplicate processing if Meta retries a webhook.
     */
    const existingMessage = await findWhatsAppMessageByExternalId(
      integration.id,
      externalMessageId,
    );

    if (existingMessage) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    /**
     * Save incoming customer message.
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
     * Build the business context for Kuba Receptionist.
     */
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

    /**
     * Select the AI employee determined by
     * Kuba's routing engine.
     *
     * Receptionist remains the fallback when
     * no department-specific AI employee has
     * been configured yet.
     */
    let selectedAgent: {
      generate: (
        input: string,
        options?: { requestContext?: RequestContext },
      ) => Promise<{
        text?: string;
      }>;
    } = kubaReceptionistAgent;

    let selectedEmployeeId =
      receptionist.id;

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

      if (routedEmployee) {
        selectedEmployeeId =
          routedEmployee.id;

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
              routingDecision.department,
            teamId:
              routingDecision.teamId,
            aiEmployeeId:
              routedEmployee.id,
            aiEmployeeType:
              routedEmployee.type,
          },
        );
      }
    }

    /**
     * Human-takeover gate.
     *
     * Only generate and send an AI reply when Kuba's routing engine has
     * actually assigned this conversation to AI, and the incoming message
     * was real text (never feed a stored non-text placeholder to the AI as
     * if it were the customer's real message). A human-assigned or
     * escalated conversation, or an unsupported message type, still gets
     * stored above for the Unified Inbox — it just never gets an
     * autonomous AI reply.
     */
    if (
      !canGenerateAiReply ||
      routingDecision.assignmentType !== "ai"
    ) {
      await db
        .update(conversations)
        .set({
          customerName,
          customerPhone,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conversation.id));

      return NextResponse.json({
        received: true,
        aiReplySkipped: true,
      });
    }

    /**
     * Generate the response.
     *
     * Until specialized Mastra agents are
     * connected to every employee type,
     * Receptionist remains the safe response
     * engine.
     */
    const result = await selectedAgent.generate(businessContext, {
      requestContext: new RequestContext([["businessId", businessId]]),
    });

    const responseText =
      String(result.text || "").trim();

    if (!responseText) {
      throw new Error(
        "Kuba AI employee returned an empty response.",
      );
    }

    /**
     * Send the AI response back through WhatsApp, using this tenant's own
     * resolved credentials — never a hardcoded global Authorization header.
     */
    const credentials =
      getWhatsAppCredentialsForIntegration(integration);

    if (!credentials) {
      console.error(
        "WhatsApp credentials are not configured for business:",
        businessId,
      );

      throw new Error(
        "WhatsApp credentials are not configured.",
      );
    }

    const sendResult = await sendWhatsAppText(credentials, customerPhone, responseText);

    if (!sendResult.success) {
      console.error(
        "WhatsApp send error:",
        sendResult.error,
      );

      throw new Error(
        "WhatsApp message could not be sent.",
      );
    }

    const externalResponseId =
      sendResult.externalMessageId || null;

    /**
     * Save Kuba's response.
     */
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      businessId: businessId,
      conversationId: conversation.id,
      integrationId: integration.id,
      externalMessageId: externalResponseId,
      direction: "outbound",
      senderType: "ai_employee",
      senderId:
        selectedEmployeeId,
      content: responseText,
      messageType: "text",
      createdAt: new Date(),
    });

    /**
     * Update conversation state to match
     * the AI employee selected by Kuba's
     * routing engine.
     */
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

    return NextResponse.json({
      received: true,
      success: true,
    });
  } catch (error) {
    console.error("WhatsApp webhook error:", error);

    return NextResponse.json(
      { error: "Invalid webhook payload" },
      { status: 400 },
    );
  }
}