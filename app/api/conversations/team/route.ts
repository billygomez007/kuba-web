import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  conversations,
  conversationRouting,
  businessTeams,
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

    const teamId =
      typeof body.teamId === "string"
        ? body.teamId.trim()
        : "";

    if (!conversationId || !teamId) {
      return NextResponse.json(
        {
          error:
            "Conversation and team are required.",
        },
        { status: 400 },
      );
    }

    const conversationResult =
      await db
        .select({
          id: conversations.id,
          businessId: conversations.businessId,
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
      conversationResult[0];

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

    const teamResult =
      await db
        .select({
          id: businessTeams.id,
          name: businessTeams.name,
          department:
            businessTeams.department,
          status: businessTeams.status,
        })
        .from(businessTeams)
        .where(
          and(
            eq(
              businessTeams.id,
              teamId,
            ),
            eq(
              businessTeams.businessId,
              conversation.businessId,
            ),
          ),
        )
        .limit(1);

    const team =
      teamResult[0];

    if (!team) {
      return NextResponse.json(
        {
          error:
            "Team not found.",
        },
        { status: 404 },
      );
    }

    if (team.status !== "active") {
      return NextResponse.json(
        {
          error:
            "This team is not active.",
        },
        { status: 409 },
      );
    }

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

    const now =
      new Date();

    if (routing) {
      await db
        .update(conversationRouting)
        .set({
          department:
            team.department,

          teamId:
            team.id,

          aiEmployeeId:
            null,

          assignedUserId:
            null,

          assignmentType:
            "team",

          status:
            "waiting_for_human",

          routingReason:
            `Conversation routed to ${team.name} team.`,

          updatedAt:
            now,
        })
        .where(
          eq(
            conversationRouting.id,
            routing.id,
          ),
        );
    } else {
      await db
        .insert(conversationRouting)
        .values({
          id:
            crypto.randomUUID(),

          businessId:
            conversation.businessId,

          conversationId,

          department:
            team.department,

          teamId:
            team.id,

          aiEmployeeId:
            null,

          assignedUserId:
            null,

          assignmentType:
            "team",

          status:
            "waiting_for_human",

          priority:
            "normal",

          confidence:
            100,

          routingReason:
            `Conversation routed to ${team.name} team.`,

          createdAt:
            now,

          updatedAt:
            now,
        });
    }

    await db
      .update(conversations)
      .set({
        assignedEmployeeId:
          null,

        aiMode:
          "paused",

        updatedAt:
          now,
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
        "conversation.team_assign",

      resource:
        "conversation",

      resourceId:
        conversationId,

      description:
        `Conversation routed to ${team.name}.`,

      metadata: {
        teamId:
          team.id,

        teamName:
          team.name,

        department:
          team.department,

        assignmentType:
          "team",

        status:
          "waiting_for_human",
      },
    });

    return NextResponse.json({
      success: true,

      team: {
        id:
          team.id,

        name:
          team.name,

        department:
          team.department,
      },

      routing: {
        teamId:
          team.id,

        department:
          team.department,

        assignmentType:
          "team",

        status:
          "waiting_for_human",
      },
    });
  } catch (error) {
    console.error(
      "Conversation team assignment error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to route conversation to team.",
      },
      { status: 500 },
    );
  }
}
