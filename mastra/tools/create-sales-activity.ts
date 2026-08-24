import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, salesActivities } from "@/db/schema";
import { requireBusinessId } from "./business-context";

export const createSalesActivityTool = createTool({
  id: "create-sales-activity",

  description:
    "Record a sales activity against an existing lead belonging to the current business. ONLY use this tool when a real sales interaction actually occurred and the user explicitly confirms it, such as saying they spoke with, contacted, emailed, called, messaged, met, or followed up with a lead. NEVER use this tool merely because the user says 'do it', 'go ahead', 'handle it', 'proceed', or approves a recommended action. Do not create an activity for an interaction that has not actually happened.",

  inputSchema: z.object({
    leadName: z
      .string()
      .describe("The exact name of the lead."),

    type: z
      .string()
      .describe(
        "The activity type, such as call, email, message, meeting, note, or follow_up.",
      ),

    title: z
      .string()
      .describe("A short title describing the sales activity."),

    description: z
      .string()
      .describe("A concise description of what happened."),
  }),

  execute: async ({
    leadName,
    type,
    title,
    description,
  }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
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

    const now = new Date();

    const result = await db
      .insert(salesActivities)
      .values({
        id: crypto.randomUUID(),
        businessId,
        leadId: lead.id,
        employeeId: null,
        type,
        title,
        description,
        createdAt: now,
      })
      .returning({
        id: salesActivities.id,
        leadId: salesActivities.leadId,
        type: salesActivities.type,
        title: salesActivities.title,
        description: salesActivities.description,
        createdAt: salesActivities.createdAt,
      });

    return {
      success: true,
      activity: result[0],
      lead,
    };
  },
});
