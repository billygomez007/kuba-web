import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { followUps, leads, aiEmployees } from "@/db/schema";

export const createFollowUpTool = createTool({
  id: "create-follow-up",

  description:
    "Create a follow-up for a lead belonging to the current business. Use this when the user asks to create, schedule, or set a follow-up.",

  inputSchema: z.object({
    businessId: z
      .string()
      .describe("The ID of the current business."),

    leadName: z
      .string()
      .describe("The exact name of the lead."),

    title: z
      .string()
      .describe("A short title for the follow-up."),

    description: z
      .string()
      .optional()
      .describe("Additional details about the follow-up."),

    dueAt: z
      .string()
      .describe("The follow-up date and time in ISO 8601 format."),
  }),

  execute: async ({
    businessId,
    leadName,
    title,
    description,
    dueAt,
  }) => {
    const matchingLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
      })
      .from(leads)
      .where(
        and(
          eq(leads.businessId, businessId),
          eq(leads.name, leadName),
        ),
      )
      .limit(1);

    if (matchingLeads.length === 0) {
      return {
        success: false,
        error: `No lead named "${leadName}" was found in this business.`,
      };
    }

    const lead = matchingLeads[0];

    const parsedDueAt = new Date(dueAt);

    if (Number.isNaN(parsedDueAt.getTime())) {
      return {
        success: false,
        error: "The follow-up date is invalid.",
      };
    }

    const now = new Date();
    const followUpId = crypto.randomUUID();

    const salesEmployee = await db
      .select({
        id: aiEmployees.id,
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

    const assignedEmployeeId =
      salesEmployee[0]?.id || null;

    const result = await db
      .insert(followUps)
      .values({
        id: followUpId,
        businessId,
        leadId: lead.id,
        assignedEmployeeId,
        title,
        description: description || null,
        dueAt: parsedDueAt,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .returning({
        id: followUps.id,
        leadId: followUps.leadId,
        title: followUps.title,
        description: followUps.description,
        dueAt: followUps.dueAt,
        status: followUps.status,
      });

    return {
      success: true,
      followUp: result[0],
      lead,
    };
  },
});