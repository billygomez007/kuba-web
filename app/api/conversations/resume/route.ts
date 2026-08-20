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
     * Find the existing routing record.
     */
    const routingResult =
      await db
        .select({
          id:
            conversationRouting.id,

          aiEmployeeId:
            conversationRouting.aiEmployeeId,

          teamId:
            conversationRouting.teamId,

          department:
            conversationRouting.department,
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

    /*
     * We can only resume AI if Kuba still
     * knows which AI employee should handle
     * the conversation.
     */
    if (
      !routing?.aiEmployeeId
    ) {
      return NextResponse.json(
        {
          error:
            "No AI employee is assigned to this conversation.",
        },
        { status: 409 },
      );
    }

    /*
     * Return the conversation to AI handling.
     *
     * IMPORTANT:
     * teamId and department remain untouched.
     *
     * This means the conversation remains
     * inside the same team workspace.
     */
    await db
      .update(conversationRouting)
      .set({
        assignedUserId:
          null,

        assignmentType:
          "ai",

        status:
          "ai_handling",

        updatedAt:
          new Date(),
      })
      .where(
        eq(
          conversationRouting.id,
          routing.id,
        ),
      );

    /*
     * Keep the legacy conversation state
     * synchronized.
     */
    await db
      .update(conversations)
      .set({
        assignedEmployeeId:
          routing.aiEmployeeId,

        aiMode:
          "active",

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
        "conversation.resume",

      resource:
        "conversation",

      resourceId:
        conversationId,

      description:
        "AI resumed handling the conversation.",

      metadata: {
        aiEmployeeId:
          routing.aiEmployeeId,

        teamId:
          routing.teamId,

        department:
          routing.department,

        assignmentType:
          "ai",

        status:
          "ai_handling",
      },
    });

    return NextResponse.json({
      success: true,

      message:
        "AI resumed.",

      routing: {
        aiEmployeeId:
          routing.aiEmployeeId,

        teamId:
          routing.teamId,

        department:
          routing.department,

        assignmentType:
          "ai",

        status:
          "ai_handling",
      },
    });
  } catch (error) {
    console.error(
      "Conversation resume error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to resume AI.",
      },
      { status: 500 },
    );
  }
}
