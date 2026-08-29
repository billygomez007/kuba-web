import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  conversations,
  conversationRouting,
  aiEmployees,
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
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";

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

    const employeeId =
      typeof body.employeeId === "string"
        ? body.employeeId.trim()
        : "";

    if (
      !conversationId ||
      !employeeId
    ) {
      return NextResponse.json(
        {
          error:
            "Conversation and employee are required.",
        },
        { status: 400 },
      );
    }

    const conversationResult =
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

    /*
     * The user must belong to the
     * conversation's business.
     */
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

    /*
     * The user must be allowed to
     * interact with this conversation.
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
     * Managing assignments remains a
     * privileged operation.
     */
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

    if (!hasCapability(await getBusinessEntitlements(conversation.businessId), "customer_ops.conversations")) {
      return NextResponse.json(
        { error: "Conversation management requires the Growth plan or higher.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["customer_ops.conversations"] },
        { status: 403 },
      );
    }

    /*
     * Confirm the AI employee belongs
     * to the same business.
     */
    const employeeResult =
      await db
        .select({
          id:
            aiEmployees.id,
          name:
            aiEmployees.name,
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
              employeeId,
            ),
            eq(
              aiEmployees.businessId,
              conversation.businessId,
            ),
          ),
        )
        .limit(1);

    const employee =
      employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "AI employee not found.",
        },
        { status: 404 },
      );
    }

    /*
     * Find the current routing record.
     */
    const routingResult =
      await db
        .select({
          id:
            conversationRouting.id,
          department:
            conversationRouting.department,
          teamId:
            conversationRouting.teamId,
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
            employee.id,

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
            "reception",

          teamId:
            null,

          aiEmployeeId:
            employee.id,

          assignedUserId:
            null,

          assignmentType:
            "ai",

          status:
            "ai_handling",

          priority:
            "normal",

          confidence:
            100,

          routingReason:
            "Conversation manually assigned to AI employee.",

          createdAt:
            new Date(),

          updatedAt:
            new Date(),
        });
    }

    /*
     * Keep the legacy field synchronized
     * for existing parts of Kuba that still
     * use assignedEmployeeId.
     */
    await db
      .update(conversations)
      .set({
        assignedEmployeeId:
          employee.id,

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
        "conversation.assign",

      resource:
        "conversation",

      resourceId:
        conversationId,

      description:
        `Conversation assigned to ${employee.name}.`,

      metadata: {
        employeeId:
          employee.id,

        assignmentType:
          "ai",
      },
    });

    return NextResponse.json({
      success: true,

      employee,

      routing: {
        aiEmployeeId:
          employee.id,

        assignmentType:
          "ai",

        status:
          "ai_handling",
      },
    });
  } catch (error) {
    console.error(
      "Conversation assignment error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to assign conversation.",
      },
      { status: 500 },
    );
  }
}
