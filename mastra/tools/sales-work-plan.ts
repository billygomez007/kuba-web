import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq, asc } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployees,
  leads,
  followUps,
} from "@/db/schema";

export const salesWorkPlanTool = createTool({
  id: "sales-work-plan",

  description:
    "Review the current Sales AI work queue and identify leads and follow-ups that need attention.",

  inputSchema: z.object({
    businessId: z
      .string()
      .describe("The ID of the current business."),
  }),

  execute: async ({ businessId }) => {
    const employee = await db
      .select({
        id: aiEmployees.id,
        name: aiEmployees.name,
      })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.businessId, businessId),
          eq(aiEmployees.type, "sales"),
          eq(aiEmployees.status, "active"),
        ),
      )
      .limit(1);

    if (!employee[0]) {
      return {
        success: false,
        message: "No active Sales AI employee was found.",
        leads: [],
        followUps: [],
      };
    }

    const assignedLeads = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(leads.businessId, businessId),
          eq(
            leads.assignedEmployeeId,
            employee[0].id,
          ),
        ),
      )
      .orderBy(asc(leads.updatedAt));

    const pendingFollowUps = await db
      .select()
      .from(followUps)
      .where(
        and(
          eq(followUps.businessId, businessId),
          eq(
            followUps.assignedEmployeeId,
            employee[0].id,
          ),
          eq(followUps.status, "pending"),
        ),
      )
      .orderBy(asc(followUps.dueAt));

    return {
      success: true,
      employee: employee[0],
      leads: assignedLeads,
      followUps: pendingFollowUps,
      leadCount: assignedLeads.length,
      followUpCount: pendingFollowUps.length,
    };
  },
});
