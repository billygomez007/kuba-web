import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { db } from "@/db";
import { getChannelAdapter } from "@/lib/channels/router";
import { routeConversation } from "@/lib/ai-routing/router";
import { shouldCreateFollowUp } from "@/lib/ai/followup-detector";
import { logAIActivity } from "@/lib/ai/activity-log";
import { canAccessConversation } from "@/lib/communications/conversation-access";
import {
  messages,
  conversations,
  aiEmployees,
  leads,
  followUps,
  integrations,
} from "@/db/schema";


export async function POST(
  request: Request,
) {

  const session = await auth.api.getSession({
    headers: await headers(),
  });


  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }


  const body = await request.json();

  const {
    conversationId,
    content,
  } = body;


  if (!conversationId || !content) {
    return NextResponse.json(
      {
        error: "Conversation and message required",
      },
      {
        status: 400,
      },
    );
  }


  const membership = await getCurrentMembership();
  const business = membership ? { businessId: membership.businessId } : null;


  if (!business) {
    return NextResponse.json(
      {
        error: "Business not found",
      },
      {
        status: 404,
      },
    );
  }

  const senderMembership = await getBusinessMembership(session.user.id, business.businessId);
  if (!senderMembership || !hasPermission(senderMembership.role, senderMembership.permissions, PERMISSIONS.MESSAGING_MANAGE)) {
    return NextResponse.json({ error: "You do not have permission to send messages." }, { status: 403 });
  }


  const conversation = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(
          conversations.id,
          conversationId,
        ),
        eq(
          conversations.businessId,
          business.businessId,
        ),
      ),
    )
    .limit(1);


  if (!conversation[0]) {
    return NextResponse.json(
      {
        error: "Conversation not found",
      },
      {
        status: 404,
      },
    );
  }

  /*
   * Central conversation access check.
   *
   * A user may only send into conversations
   * that belong to their authorized workspace.
   *
   * This prevents a user from bypassing team
   * restrictions simply by knowing a conversation ID.
   */
  const access =
    await canAccessConversation(
      session.user.id,
      conversationId,
    );

  if (!access.allowed) {
    return NextResponse.json(
      {
        error:
          "You do not have permission to send messages in this conversation.",
      },
      { status: 403 },
    );
  }

  const now = new Date();

  const integration = await db
    .select({ id: integrations.id, provider: integrations.provider })
    .from(integrations)
    .where(and(eq(integrations.id, conversation[0].integrationId), eq(integrations.businessId, business.businessId)))
    .limit(1);
  const provider = integration[0]?.provider === "website_chat" ? "website" : integration[0]?.provider;
  const supportedChannels = new Set([
    "whatsapp",
    "email",
    "website",
    "facebook",
    "instagram",
    "telegram",
    "sms",
  ]);
  if (!provider || !supportedChannels.has(provider)) {
    return NextResponse.json({ error: "Conversation channel is not configured." }, { status: 409 });
  }

  const channel = provider as
    | "whatsapp"
    | "email"
    | "website"
    | "facebook"
    | "instagram"
    | "telegram"
    | "sms";

  const trimmedContent = typeof content === "string" ? content.trim() : "";
  if (!trimmedContent) {
    return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
  }

  if (channel === "email" && !conversation[0].customerEmail) {
    return NextResponse.json({ error: "This conversation has no customer email address." }, { status: 400 });
  }

  let subject: string | undefined;
  if (channel === "email") {
    const latestInbound = await db
      .select({ metadata: messages.metadata })
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.businessId, business.businessId), eq(messages.direction, "inbound")))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    try {
      const metadata = latestInbound[0]?.metadata ? JSON.parse(latestInbound[0].metadata) as { subject?: unknown } : null;
      const inboundSubject = typeof metadata?.subject === "string" ? metadata.subject.trim() : "";
      subject = inboundSubject ? (/^re:\s*/i.test(inboundSubject) ? inboundSubject : `Re: ${inboundSubject}`) : "Re: Your SuperKuba message";
    } catch {
      subject = "Re: Your SuperKuba message";
    }
  }


  const routing = channel === "email" ? null : routeConversation(trimmedContent);


  const assignedEmployee = routing ? await db
      .select()
      .from(aiEmployees)
      .where(
        and(
          eq(
            aiEmployees.name,
            routing.employee,
          ),
          eq(
            aiEmployees.businessId,
            business.businessId,
          ),
        ),
      )
      .limit(1) : [];


  if (assignedEmployee[0]) {

    await db
      .update(conversations)
      .set({
        assignedEmployeeId:
          assignedEmployee[0].id,
      })
      .where(
        and(
          eq(
            conversations.id,
            conversationId,
          ),
          eq(
            conversations.businessId,
            business.businessId,
          ),
        ),
      );

  }




  if (
      channel !== "email" &&
    shouldCreateFollowUp(trimmedContent) &&
    assignedEmployee[0] &&
    conversation[0].customerId
  ) {

    const existingLead =
      await db
        .select()
        .from(leads)
        .where(
          and(
            eq(
              leads.customerId,
              conversation[0].customerId,
            ),
            eq(
              leads.businessId,
              business.businessId,
            ),
          ),
        )
        .limit(1);


    if(existingLead[0]) {

      await db.insert(followUps).values({

        id:
          crypto.randomUUID(),

        businessId:
          business.businessId,

        leadId:
          existingLead[0].id,

        assignedEmployeeId:
          assignedEmployee[0].id,

        title:
          "Follow up with customer",

        description:
          trimmedContent,

        dueAt:
          new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ),

        status:
          "pending",

        createdAt:
          new Date(),

        updatedAt:
          new Date(),

      });

      await logAIActivity({

        businessId:
          business.businessId,

        employeeId:
          assignedEmployee[0].id,

        type:
          "follow_up_created",

        title:
          "Created follow-up task",

        description:
          "Follow up with customer",

      });

    }

  }


  if (
    (channel === "facebook" || channel === "instagram") &&
    !conversation[0].externalConversationId
  ) {
    return NextResponse.json(
      {
        error:
          "This social conversation has no external recipient identifier.",
      },
      { status: 400 },
    );
  }

  const adapter =
    getChannelAdapter(channel);

  const sent =
    await adapter.send({
      businessId: business.businessId,
      conversationId,
      integrationId: conversation[0].integrationId,
      recipient:
        channel === "email"
          ? conversation[0].customerEmail!
          : channel === "facebook" || channel === "instagram"
            ? conversation[0].externalConversationId!
            : conversation[0].customerPhone ||
              conversation[0].customerEmail ||
              conversation[0].externalConversationId ||
              "unknown",
      message: trimmedContent,
      ...(subject ? { subject } : {}),
    });

  if (!sent.success) {
    return NextResponse.json({ error: "Unable to send this message." }, { status: 502 });
  }

  if (sent.externalMessageId) {
    const existing = await db
      .select({ id: messages.id })
      .from(messages)
      .where(and(eq(messages.businessId, business.businessId), eq(messages.externalMessageId, sent.externalMessageId)))
      .limit(1);
    if (existing[0]) return NextResponse.json({ success: true, duplicate: true });
  }


  await db.insert(messages).values({
    id: crypto.randomUUID(),
    businessId: business.businessId,
    conversationId,
    integrationId: conversation[0].integrationId,
    externalMessageId:
      sent.externalMessageId || null,
    direction: "outbound",
    senderType: "human",
    senderId: session.user.id,
    content: trimmedContent,
    messageType: "text",
    status: channel === "email" ? "sent" : null,
    metadata: channel === "email" ? JSON.stringify({ channel: "email", subject, replyTo: sent.replyTo ?? null }) : null,
    createdAt: now,
  });

  /*
   * Human-authored replies stop here.
   *
   * /api/messages/send represents an explicit human action in the
   * Unified Inbox. Never generate a second AI response after the
   * human message has already been sent to the customer.
   */
  await db
    .update(conversations)
    .set({
      updatedAt: now,
    })
    .where(
      eq(
        conversations.id,
        conversationId,
      ),
    );


  return NextResponse.json({
    success: true,
  });
}
