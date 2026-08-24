import { and, eq } from "drizzle-orm";

import { db } from "@/db";

import {
  businessTeams,
  aiEmployeeTeams,
} from "@/db/schema";

import {
  ConversationDepartment,
  RoutingContext,
  RoutingDecision,
} from "./routing";

import { routeConversation } from "./router";

export async function routeConversationToTeam(
  context: RoutingContext,
): Promise<RoutingDecision> {
  const initial =
    routeConversation(context);

  /*
   * routeConversation already preserved a human's
   * existing ownership of this conversation. Don't let
   * team routing override that back to AI/team below.
   */
  if (context.currentAssignedUserId) {
    return initial;
  }

  const teams =
    await db
      .select({
        id: businessTeams.id,
        department:
          businessTeams.department,
        name:
          businessTeams.name,
        status:
          businessTeams.status,
      })
      .from(businessTeams)
      .where(
        and(
          eq(
            businessTeams.businessId,
            context.businessId,
          ),
          eq(
            businessTeams.department,
            initial.department,
          ),
          eq(
            businessTeams.status,
            "active",
          ),
        ),
      );

  /*
   * No team has been created for this
   * department yet. Keep the AI routing
   * decision, but don't invent a team.
   */
  if (teams.length === 0) {
    return initial;
  }

  /*
   * If the conversation already belongs
   * to a team, keep that team unless the
   * current routing explicitly changed it.
   */
  if (context.currentTeamId) {
    const existingTeam =
      teams.find(
        (team) =>
          team.id ===
          context.currentTeamId,
      );

    if (existingTeam) {
      return {
        ...initial,
        teamId:
          existingTeam.id,
        reason:
          `${initial.reason} Conversation remains with ${existingTeam.name}.`,
      };
    }
  }

  /*
   * For now, use the first active team
   * for the detected department.
   *
   * We will later add routing rules,
   * priorities and workload balancing.
   */
  const selectedTeam =
    teams[0];

  /*
   * Find an AI employee assigned to
   * this team.
   */
  const aiEmployees =
    await db
      .select({
        aiEmployeeId:
          aiEmployeeTeams.aiEmployeeId,
      })
      .from(aiEmployeeTeams)
      .where(
        eq(
          aiEmployeeTeams.teamId,
          selectedTeam.id,
        ),
      )
      .limit(1);

  const aiEmployee =
    aiEmployees[0];

  return {
    ...initial,

    teamId:
      selectedTeam.id,

    aiEmployeeId:
      aiEmployee?.aiEmployeeId ??
      null,

    assignmentType:
      aiEmployee
        ? "ai"
        : "team",

    reason:
      `${initial.reason} Routed to ${selectedTeam.name}.`,
  };
}
