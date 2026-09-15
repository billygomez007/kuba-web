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
  findWhatsAppMessageByExternalId,
  getWhatsAppCredentialsForIntegration,
  resolveWhatsAppIntegrationByPhoneNumberId,
  sendWhatsAppText,
  verifyMetaSignature,
} from "@/lib/channels/whatsapp";
import { safeCompareSecret } from "@/lib/auth/security";

import {
  routeConversationToTeam,
} from "@/lib/communications/team-router";
import type { ConversationDepartment } from "@/lib/communications/routing";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { getKubaAgent, type KubaAgentLike } from "@/lib/communications/ai-agent-registry";
import { getBusinessEntitlements } from "@/lib/billing/entitlements";
import { isEmployeeImplementationAvailable, isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";
import { resolveEmployeeForDepartment } from "@/lib/communications/handoff";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Message types SuperKuba can extract customer intent from today and hand
// to an AI employee. Anything else is stored so it appears in the Unified
// Inbox for a human to review, but never fabricated content for the AI to
// respond to.
const TEXT_LIKE_MESSAGE_TYPES = new Set(["text", "interactive"]);

function extractCustomerContent(
  incomingMessage: Record<string, unknown>,
  messageType: string,
): { content: string; canGenerateAiReply: boolean } {
  const canGenerateAiReply = TEXT_LIKE_MESSAGE_TYPES.has(messageType);

  if (messageType === "text") {
    const text = incomingMessage as { text?: { body?: string } };
    return {
      content: String(text.text?.body || "").trim(),
      canGenerateAiReply,
    };
  }

  if (messageType === "interactive") {
    const interactive = incomingMessage as {
      interactive?: {
        button_reply?: { title?: string };
        list_reply?: { title?: string };
      };
    };
    const title =
      interactive.interactive?.button_reply?.title ||
      interactive.interactive?.list_reply?.title ||
      "";
    return { content: title.trim(), canGenerateAiReply };
  }

  // image, document, audio, video, sticker, location, contacts, and any
  // other type: acknowledge and log for the Unified Inbox, but do not
  // pretend the AI can see content it was never given.
  return {
    content: `[Customer sent a "${messageType}" message. Viewing this content type is not yet supported — a human should follow up.]`,
    canGenerateAiReply: false,
  };
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
    challenge &&
    safeCompareSecret(token, VERIFY_TOKEN)
  ) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * Receive WhatsApp messages and status callbacks from Meta.
 */
export async function POST(request: Request) {
  try {
    const rawBody = await request.text();

    const signature = request.headers.get("x-hub-signature-256");

    if (!verifyMetaSignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET)) {
      console.error("Invalid WhatsApp webhook signature.");
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = JSON.parse(rawBody);

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
      console.error("WhatsApp phone number ID is missing.");
      return NextResponse.json(
        { error: "WhatsApp phone number is not configured." },
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
    const resolved = await resolveWhatsAppIntegrationByPhoneNumberId(
      incomingPhoneNumberId,
    );

    if (!resolved) {
      console.error("Unregistered WhatsApp phone number:", incomingPhoneNumberId);
      return NextResponse.json(
        { error: "WhatsApp number is not registered with Kuba." },
        { status: 404 },
      );
    }

    const integration = resolved.integration;
    const business = resolved.business;
    const businessId = business.id;

    if (business.status !== "active") {
      console.error("WhatsApp business is inactive:", businessId);
      return NextResponse.json(
        { error: "Kuba business is inactive." },
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
     * These are not customer messages — map them onto the outbound message
     * we already stored, matched by Meta's message id, and acknowledge.
     * Meta may send this independently of any inbound customer message.
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

    const { content: customerMessage, canGenerateAiReply } =
      extractCustomerContent(incomingMessage, messageType);

    if (!customerMessage) {
      return NextResponse.json({ received: true });
    }

    const customerName = value.contacts?.[0]?.profile?.name || customerPhone;

    /**
     * Prevent duplicate processing if Meta retries a webhook.
     */
    const existingMessage = await findWhatsAppMessageByExternalId(
      integration.id,
      externalMessageId,
    );

    if (existingMessage) {
      return NextResponse.json({ received: true, duplicate: true });
    }

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
      console.error("No active Kuba Receptionist found for business:", businessId);
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
          eq(conversations.integrationId, integration.id),
          eq(conversations.externalConversationId, externalConversationId),
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
      throw new Error("Unable to create or load WhatsApp conversation.");
    }

    /**
     * Read the existing routing state.
     *
     * This allows an existing conversation to remain
     * with its current team/human owner unless the
     * router explicitly changes it.
     */
    const existingRoutingStateResult = await db
      .select({
        department: conversationRouting.department,
        teamId: conversationRouting.teamId,
        aiEmployeeId: conversationRouting.aiEmployeeId,
        assignedUserId: conversationRouting.assignedUserId,
      })
      .from(conversationRouting)
      .where(eq(conversationRouting.conversationId, conversation.id))
      .limit(1);

    const existingRoutingState = existingRoutingStateResult[0];

    /**
     * Route the conversation through Kuba's
     * department and team routing engine.
     *
     * Reception remains the initial AI handler,
     * but the routing decision is stored separately
     * so the conversation can move between teams
     * without changing the underlying WhatsApp number.
     */
    const routingDecision = await routeConversationToTeam({
      businessId,
      conversationId: conversation.id,
      customerId: customerPhone,
      channel: "whatsapp",
      message: customerMessage,
      currentDepartment:
        typeof existingRoutingState?.department === "string"
          ? (existingRoutingState.department as ConversationDepartment)
          : null,
      currentTeamId: existingRoutingState?.teamId ?? null,
      currentAiEmployeeId:
        existingRoutingState?.aiEmployeeId ?? conversation.assignedEmployeeId ?? null,
      currentAssignedUserId: existingRoutingState?.assignedUserId ?? null,
    });

    const existingRouting = await db
      .select({ id: conversationRouting.id })
      .from(conversationRouting)
      .where(eq(conversationRouting.conversationId, conversation.id))
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
        .where(eq(conversationRouting.conversationId, conversation.id));
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
     * Select the AI employee determined by Kuba's routing engine, and
     * update conversation state to match — this happens regardless of
     * whether an AI reply is generated below, so the Unified Inbox always
     * reflects the latest routing/assignment decision.
     *
     * A routed employee is only actually used when it is both commercially
     * entitled and has a real runtime today — the same two-dimensional
     * check activation itself uses (lib/billing/ai-workforce-policy.ts) —
     * so a business that has been downgraded, or a routing rule pointing at
     * a type with no implementation, can never have a conversation silently
     * handled by an employee it should not have access to.
     */
    let selectedAgent: KubaAgentLike = kubaReceptionistAgent;

    let selectedEmployeeId = receptionist.id;
    let selectedEmployeeType: string = receptionist.type;

    if (routingDecision.aiEmployeeId) {
      const workforceEntitlements = await getBusinessEntitlements(businessId);

      const routedEmployeeResult = await db
        .select({ id: aiEmployees.id, type: aiEmployees.type, status: aiEmployees.status })
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.id, routingDecision.aiEmployeeId),
            eq(aiEmployees.businessId, businessId),
            eq(aiEmployees.status, "active"),
          ),
        )
        .limit(1);

      const routedEmployee = routedEmployeeResult[0];

      if (
        routedEmployee &&
        isEmployeeTypeEntitled(workforceEntitlements, routedEmployee.type) &&
        isEmployeeImplementationAvailable(routedEmployee.type)
      ) {
        selectedEmployeeId = routedEmployee.id;
        selectedEmployeeType = routedEmployee.type;
        selectedAgent = getKubaAgent(routedEmployee.type);

        console.log("Kuba routed conversation:", {
          conversationId: conversation.id,
          department: routingDecision.department,
          teamId: routingDecision.teamId,
          aiEmployeeId: routedEmployee.id,
          aiEmployeeType: routedEmployee.type,
        });
      }
    }

    /*
     * No team-based AI employee was resolved — try a direct, type-based
     * match for the detected department (mirrors the same fallback in
     * app/api/integrations/website-chat/route.ts), so a business without
     * Teams/aiEmployeeTeams configured still gets real department-aware
     * routing on WhatsApp instead of always defaulting to Receptionist.
     */
    if (selectedEmployeeId === receptionist.id && routingDecision.department) {
      try {
        const directResolution = await resolveEmployeeForDepartment({
          businessId,
          department: routingDecision.department,
          channel: "whatsapp",
        });

        if (directResolution.ok && directResolution.employee.id !== receptionist.id) {
          selectedEmployeeId = directResolution.employee.id;
          selectedEmployeeType = directResolution.employee.type;
          selectedAgent = getKubaAgent(directResolution.employee.type);

          await db
            .update(conversationRouting)
            .set({ aiEmployeeId: directResolution.employee.id, updatedAt: new Date() })
            .where(eq(conversationRouting.conversationId, conversation.id));
        }
      } catch (directRoutingError) {
        console.error("WhatsApp direct-type routing error:", directRoutingError);
      }
    }

    await db
      .update(conversations)
      .set({
        customerName,
        customerPhone,
        assignedEmployeeId: selectedEmployeeId,
        aiMode: routingDecision.assignmentType === "ai" ? "active" : "paused",
        status:
          routingDecision.status === "resolved"
            ? "resolved"
            : routingDecision.status === "escalated"
              ? "escalated"
              : "open",
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversation.id));

    /**
     * A human (or a team, pending human pickup) currently owns this
     * conversation, or the message type doesn't carry enough information
     * for the AI to respond to — do not generate or send an AI reply.
     * The customer's message is already stored above for the human/team
     * to see in the Unified Inbox.
     */
    if (!canGenerateAiReply || routingDecision.assignmentType !== "ai") {
      return NextResponse.json({ received: true, success: true, aiReplySkipped: true });
    }

    /**
     * Recent conversation history, so the customer never has to repeat
     * themselves — this matters most right after an AI-to-AI handoff, where
     * a different employee (with no memory of prior turns) picks up the
     * SAME conversation.
     */
    let conversationHistory = "No earlier messages in this conversation.";
    try {
      const historyRows = await db
        .select({ direction: messages.direction, content: messages.content, createdAt: messages.createdAt })
        .from(messages)
        .where(and(eq(messages.conversationId, conversation.id), eq(messages.businessId, businessId)));
      const priorMessages = historyRows
        .filter((row) => row.content)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(0, -1); // drop the just-saved current customer message, shown separately below
      if (priorMessages.length > 0) {
        conversationHistory = priorMessages
          .slice(-10)
          .map((row) => `${row.direction === "inbound" ? "Customer" : "Kuba"}: ${row.content}`)
          .join("\n");
      }
    } catch (historyError) {
      console.error("WhatsApp history load error:", historyError);
    }

    /**
     * Build the business context for the SELECTED employee — never
     * hardcoded to Receptionist, since routing above may have selected
     * Sales, Customer Support, or Appointment instead.
     */
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
     * Send the AI response back through WhatsApp, using this tenant's own
     * resolved credentials — never a hardcoded global Authorization header.
     * Resolved and validated before generating a reply so a misconfigured
     * integration fails fast instead of paying for an AI generation that
     * can never be delivered.
     */
    const credentials = getWhatsAppCredentialsForIntegration(integration);

    if (!credentials) {
      console.error("WhatsApp credentials are not configured for business:", businessId);
      return NextResponse.json(
        { error: "WhatsApp credentials are not configured." },
        { status: 500 },
      );
    }

    /**
     * Generate the response.
     */
    const result = await selectedAgent.generate(businessContext, {
      requestContext: new RequestContext([
        ["businessId", businessId],
        ["employeeId", selectedEmployeeId],
        ["conversationId", conversation.id],
        ["channel", "whatsapp"],
      ]),
    });

    const responseText = String(result.text || "").trim();

    if (!responseText) {
      throw new Error("Kuba AI employee returned an empty response.");
    }

    const sendResult = await sendWhatsAppText(credentials, customerPhone, responseText);

    if (!sendResult.success) {
      console.error("WhatsApp send error:", sendResult.error);
      throw new Error("WhatsApp message could not be sent.");
    }

    /**
     * Save Kuba's response.
     */
    await db.insert(messages).values({
      id: crypto.randomUUID(),
      businessId: businessId,
      conversationId: conversation.id,
      integrationId: integration.id,
      externalMessageId: sendResult.externalMessageId || null,
      direction: "outbound",
      senderType: "ai_employee",
      senderId: selectedEmployeeId,
      content: responseText,
      messageType: "text",
      createdAt: new Date(),
    });

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
