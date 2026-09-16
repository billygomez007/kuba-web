import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { db } from "@/db";
import { getChannelAdapter } from "@/lib/channels/router";
import { routeConversation } from "@/lib/ai-routing/router";
import { kubaSalesAgent } from "@/mastra/agents/sales";
import { getBusinessKnowledge } from "@/lib/ai/business-knowledge";
import { shouldCreateFollowUp } from "@/lib/ai/followup-detector";
import { logAIActivity } from "@/lib/ai/activity-log";
import { canAccessConversation } from "@/lib/communications/conversation-access";
import {
  messages,
  conversations,
  aiEmployees,
  aiEmployeeActivities,
  leads,
  followUps,
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


  const businessContext =
    await getBusinessKnowledge(
      business.businessId,
    );


  const routing =
    routeConversation(content);


  const assignedEmployee =
    await db
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
      .limit(1);


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
    shouldCreateFollowUp(content) &&
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
          content,

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


  const channel =
    conversation[0].integrationId as
      | "whatsapp"
      | "email"
      | "website"
      | "facebook"
      | "instagram"
      | "telegram"
      | "sms";

  const adapter =
    getChannelAdapter(channel);

  const sent =
    await adapter.send({
      businessId: business.businessId,
      conversationId,
      recipient:
        conversation[0].customerPhone ||
        conversation[0].customerEmail ||
        "unknown",
      message: content,
    });


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
    content,
    messageType: "text",
    createdAt: now,
  });

  const aiResult = channel === "email" ? null : await kubaSalesAgent.generate(
      `${businessContext}

CUSTOMER MESSAGE:
${content}`,
      {
        memory: {
          resource: session.user.id,
          thread: `messaging-${business.businessId}`,
        },
        requestContext: new RequestContext([["businessId", business.businessId], ["employeeId", assignedEmployee[0]?.id ?? ""]]),
      },
    );


  if (aiResult) await db.insert(messages).values({
    id: crypto.randomUUID(),
    businessId: business.businessId,
    conversationId,
    integrationId: conversation[0].integrationId,
    externalMessageId: null,
    direction: "outbound",
    senderType: "assistant",
    senderId: null,
    content: aiResult.text,
    messageType: "text",
    createdAt: new Date(),
  });


  if (aiResult && assignedEmployee[0]) {

    await logAIActivity({

      businessId:
        business.businessId,

      employeeId:
        assignedEmployee[0].id,

      type:
        "message_sent",

      title:
        "Replied to customer",

      description:
        aiResult.text,

    });

  }



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
