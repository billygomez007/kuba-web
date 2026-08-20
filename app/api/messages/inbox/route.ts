import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  eq,
  desc,
  and,
  or,
  inArray,
} from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  conversations,
  conversationRouting,
  businessUsers,
} from "@/db/schema";

import {
  getInboxAccess,
} from "@/lib/communications/inbox-access";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

export async function GET() {
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

    const membership =
      await db
        .select({
          id: businessUsers.id,
          businessId:
            businessUsers.businessId,
          role:
            businessUsers.role,
          permissions:
            businessUsers.permissions,
        })
        .from(businessUsers)
        .where(
          eq(
            businessUsers.userId,
            session.user.id,
          ),
        )
        .limit(1);

    const business =
      membership[0];

    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business not found.",
        },
        { status: 404 },
      );
    }

    const canViewAll =
      hasPermission(
        business.role,
        business.permissions,
        PERMISSIONS.USERS_VIEW,
      );

    const access =
      await getInboxAccess(
        business.businessId,
        business.id,
      );

    const baseCondition =
      eq(
        conversations.businessId,
        business.businessId,
      );

    let whereCondition =
      baseCondition;

    /*
     * Owners/admins with USERS_VIEW
     * can see the complete business inbox.
     */
    if (!canViewAll) {
      const routingConditions = [];

      /*
       * Directly assigned conversations.
       */
      routingConditions.push(
        eq(
          conversationRouting.assignedUserId,
          session.user.id,
        ),
      );

      /*
       * Conversations assigned to
       * one of the user's teams.
       */
      if (
        access.teamIds.length > 0
      ) {
        routingConditions.push(
          inArray(
            conversationRouting.teamId,
            access.teamIds,
          ),
        );
      }

      /*
       * If the employee has no team
       * or department access, they
       * should not see the inbox.
       */
      if (
        routingConditions.length === 0
      ) {
        return NextResponse.json({
          success: true,
          conversations: [],
        });
      }

      whereCondition =
        and(
          baseCondition,
          or(
            ...routingConditions,
          ),
        )!;
    }

    const inbox =
      await db
        .select({
          id:
            conversations.id,

          customerName:
            conversations.customerName,

          customerPhone:
            conversations.customerPhone,

          customerEmail:
            conversations.customerEmail,

          status:
            conversations.status,

          integrationId:
            conversations.integrationId,

          updatedAt:
            conversations.updatedAt,

          assignedEmployeeId:
            conversations.assignedEmployeeId,

          routingDepartment:
            conversationRouting.department,

          routingTeamId:
            conversationRouting.teamId,

          routingAiEmployeeId:
            conversationRouting.aiEmployeeId,

          routingAssignedUserId:
            conversationRouting.assignedUserId,

          routingAssignmentType:
            conversationRouting.assignmentType,

          routingStatus:
            conversationRouting.status,

          routingPriority:
            conversationRouting.priority,
        })
        .from(conversations)
        .leftJoin(
          conversationRouting,
          eq(
            conversations.id,
            conversationRouting.conversationId,
          ),
        )
        .where(whereCondition)
        .orderBy(
          desc(
            conversations.updatedAt,
          ),
        );

    return NextResponse.json({
      success: true,
      conversations: inbox,
    });
  } catch (error) {
    console.error(
      "Load inbox error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load inbox.",
      },
      { status: 500 },
    );
  }
}
