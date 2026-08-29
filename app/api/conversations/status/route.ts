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
import { runAutomationTrigger } from "@/lib/automations/engine";
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

    const status =
      typeof body.status === "string"
        ? body.status.trim()
        : "";

    const allowedStatuses = [
      "open",
      "waiting",
      "resolved",
      "escalated",
    ];

    if (
      !conversationId ||
      !allowedStatuses.includes(status)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid conversation or status.",
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

    if (!hasCapability(await getBusinessEntitlements(conversation.businessId), "customer_ops.conversations")) {
      return NextResponse.json(
        { error: "Conversation management requires the Growth plan or higher.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["customer_ops.conversations"] },
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
     * Update the customer-facing/business
     * conversation status.
     */
    await db
      .update(conversations)
      .set({
        status,

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

    /*
     * Keep the routing state synchronized.
     */
    const routingResult =
      await db
        .select({
          id:
            conversationRouting.id,

          assignmentType:
            conversationRouting.assignmentType,

          aiEmployeeId:
            conversationRouting.aiEmployeeId,

          assignedUserId:
            conversationRouting.assignedUserId,
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
      let routingStatus:
        | "ai_handling"
        | "waiting_for_human"
        | "human_handling"
        | "resolved"
        | "escalated";

      if (status === "resolved") {
        routingStatus =
          "resolved";
      } else if (
        status === "escalated"
      ) {
        routingStatus =
          "escalated";
      } else if (
        status === "waiting"
      ) {
        routingStatus =
          "waiting_for_human";
      } else if (
        routing.assignmentType ===
        "user"
      ) {
        routingStatus =
          "human_handling";
      } else {
        routingStatus =
          "ai_handling";
      }

      await db
        .update(conversationRouting)
        .set({
          status:
            routingStatus,

          updatedAt:
            new Date(),
        })
        .where(
          eq(
            conversationRouting.id,
            routing.id,
          ),
        );
    }

    await createAuditLog({
      businessId:
        conversation.businessId,

      userId:
        session.user.id,

      action:
        "conversation.status_change",

      resource:
        "conversation",

      resourceId:
        conversationId,

      description:
        `Conversation status changed to ${status}.`,

      metadata: {
        status,
        routingStatus:
          status === "resolved"
            ? "resolved"
            : status === "escalated"
              ? "escalated"
              : status === "waiting"
                ? "waiting_for_human"
                : routing?.assignmentType ===
                    "user"
                  ? "human_handling"
                  : "ai_handling",
      },
    });

    if (status === "escalated") {
      try {
        await runAutomationTrigger({
          businessId: conversation.businessId,
          trigger: "conversation.escalated",
          data: {
            conversationId,
            status,
          },
        });
      } catch (automationError) {
        console.error("Conversation escalation automation error:", automationError);
      }
    }

    return NextResponse.json({
      success: true,

      status,
    });
  } catch (error) {
    console.error(
      "Conversation status error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update conversation status.",
      },
      { status: 500 },
    );
  }
}
