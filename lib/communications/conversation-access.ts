import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  businessUsers,
  businessTeamMembers,
  conversationRouting,
  conversations,
} from "@/db/schema";

import {
  getInboxAccess,
} from "@/lib/communications/inbox-access";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

export async function canAccessConversation(
  userId: string,
  conversationId: string,
) {
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
    return {
      allowed: false,
      reason: "Conversation not found.",
      conversation: null,
    };
  }

  const selectedMembership = await getCurrentMembership();

  if (
    !selectedMembership ||
    selectedMembership.userId !== userId ||
    selectedMembership.businessId !== conversation.businessId
  ) {
    return {
      allowed: false,
      reason: "Conversation is outside the selected business.",
      conversation,
    };
  }

  const membershipResult =
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
        and(
          eq(
            businessUsers.userId,
            userId,
          ),
          eq(
            businessUsers.businessId,
            conversation.businessId,
          ),
        ),
      )
      .limit(1);

  const membership =
    membershipResult[0];

  if (!membership) {
    return {
      allowed: false,
      reason: "Business access denied.",
      conversation,
    };
  }

  /*
   * Business owners/admins with
   * USERS_VIEW can access the
   * complete business inbox.
   */
  if (
    hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.USERS_VIEW,
    )
  ) {
    return {
      allowed: true,
      reason: "Business-wide access.",
      conversation,
    };
  }

  const routingResult =
    await db
      .select({
        teamId:
          conversationRouting.teamId,
        assignedUserId:
          conversationRouting.assignedUserId,
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

  if (!routing) {
    return {
      allowed: false,
      reason:
        "Conversation has no routing assignment.",
      conversation,
    };
  }

  /*
   * Direct assignment always grants
   * access to the assigned human.
   */
  if (
    routing.assignedUserId === userId
  ) {
    return {
      allowed: true,
      reason: "Directly assigned.",
      conversation,
    };
  }

  /*
   * Team membership grants access to
   * conversations routed to that team.
   */
  if (routing.teamId) {
    const teamMembership =
      await db
        .select({
          id:
            businessTeamMembers.id,
        })
        .from(businessTeamMembers)
        .innerJoin(
          businessUsers,
          eq(
            businessTeamMembers.businessUserId,
            businessUsers.id,
          ),
        )
        .where(
          and(
            eq(
              businessTeamMembers.teamId,
              routing.teamId,
            ),
            eq(
              businessUsers.userId,
              userId,
            ),
            eq(
              businessUsers.businessId,
              conversation.businessId,
            ),
          ),
        )
        .limit(1);

    if (teamMembership[0]) {
      return {
        allowed: true,
        reason: "Team access.",
        conversation,
      };
    }
  }

  return {
    allowed: false,
    reason: "Conversation is outside your workspace.",
    conversation,
  };
}
