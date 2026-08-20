import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/db";

import {
  businessTeamMembers,
  businessTeams,
  conversationRouting,
} from "@/db/schema";

export async function getInboxAccess(
  businessId: string,
  userBusinessId: string,
) {
  const memberships =
    await db
      .select({
        teamId:
          businessTeamMembers.teamId,

        department:
          businessTeams.department,
      })
      .from(businessTeamMembers)
      .innerJoin(
        businessTeams,
        eq(
          businessTeamMembers.teamId,
          businessTeams.id,
        ),
      )
      .where(
        and(
          eq(
            businessTeamMembers.businessUserId,
            userBusinessId,
          ),
          eq(
            businessTeams.businessId,
            businessId,
          ),
          eq(
            businessTeams.status,
            "active",
          ),
        ),
      );

  const teamIds = memberships.map(
    (item) => item.teamId,
  );

  const departments = Array.from(
    new Set(
      memberships
        .map(
          (item) => item.department,
        )
        .filter(Boolean),
    ),
  );

  return {
    businessId,
    teamIds,
    departments,
  };
}

export function buildConversationAccessConditions(
  access: {
    teamIds: string[];
    departments: string[];
  },
) {
  const conditions = [];

  if (access.teamIds.length > 0) {
    conditions.push(
      inArray(
        conversationRouting.teamId,
        access.teamIds,
      ),
    );
  }

  return conditions;
}
