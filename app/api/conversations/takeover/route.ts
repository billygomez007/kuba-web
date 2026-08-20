import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  conversations,
  conversationRouting,
} from "@/db/schema";

import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

import {
  canAccessConversation,
} from "@/lib/communications/conversation-access";

import { createAuditLog } from "@/lib/auth/audit";

export async function POST(
  request: Request,
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body =
      await request.json();

    const conversationId =
      typeof body.conversationId === "string"
        ? body.conversationId.trim()
        : "";

    if (!conversationId) {
      return NextResponse.json(
        {
          error:
            "Conversation required.",
        },
        { status: 400 },
      );
    }

    const result =
      await db
        .select({
          id:
            conversations.id,

          businessId:
            conversations.businessId,
        })
        .from(conversations)
        .where(
          eq(
            conversations.id,
            conversationId,
          ),
        )
        .limit(1);

    const conversation =
      result[0];

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "Conversation not found.",
        },
        { status: 404 },
      );
    }

    const membership =
      await getBusinessMembership(
        session.user.id,
        conversation.businessId,
      );

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden." },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.MESSAGING_MANAGE,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage conversations.",
        },
        { status: 403 },
      );
    }

    /*
     * The user must be allowed to see
     * this conversation before taking it.
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
            "You do not have access to this conversation.",
        },
        { status: 403 },
      );
    }

    /*
     * Find existing routing record.
     */
    const routingResult =
      await db
        .select({
          id:
            conversationRouting.id,
        })
        .from(conversationRouting)
        .where(
          eq(
            conversationRouting.conversationId,
            conversationId,
          ),
        )
        .limit(1);

    const routing =
      routingResult[0];

    if (routing) {
      await db
        .update(conversationRouting)
        .set({
          aiEmployeeId:
            null,

          assignedUserId:
            session.user.id,

          assignmentType:
            "user",

          status:
            "human_handling",

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            conversationRouting.id,
            routing.id,
          ),
        );
    } else {
      /*
       * This should mainly protect older
       * conversations that were created
       * before conversationRouting existed.
       */
      await db
        .insert(conversationRouting)
        .values({
          id:
            crypto.randomUUID(),

          businessId:
            conversation.businessId,

          conversationId,

          department:
            "reception",

          teamId:
            null,

          aiEmployeeId:
            null,

          assignedUserId:
            session.user.id,

          assignmentType:
            "user",

          status:
            "human_handling",

          priority:
            "normal",

          confidence:
            100,

          routingReason:
            "Conversation taken over by a human user.",

          createdAt:
            new Date(),

          updatedAt:
            new Date(),
        });
    }

    /*
     * Keep the legacy conversation state
     * synchronized with the new routing system.
     */
    await db
      .update(conversations)
      .set({
        assignedEmployeeId:
          null,

        aiMode:
          "paused",

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
            conversation.businessId,
          ),
        ),
      );

    await createAuditLog({
      businessId:
        conversation.businessId,

      userId:
        session.user.id,

      action:
        "conversation.takeover",

      resource:
        "conversation",

      resourceId:
        conversationId,

      description:
        "Conversation taken over by a human user.",

      metadata: {
        assignedUserId:
          session.user.id,

        assignmentType:
          "user",

        status:
          "human_handling",
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "Conversation taken over by you.",

      routing: {
        assignedUserId:
          session.user.id,

        assignmentType:
          "user",

        status:
          "human_handling",
      },
    });
  } catch (error) {
    console.error(
      "Conversation takeover error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to take over conversation.",
      },
      { status: 500 },
    );
  }
}
