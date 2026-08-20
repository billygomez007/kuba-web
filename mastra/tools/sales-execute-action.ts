import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { leads, followUps, salesActivities } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const salesExecuteActionTool = createTool({
  id: "sales-execute-action",

  description:
    "Execute one approved Sales action for the current business. Use only when the requested action is explicitly permitted.",

  inputSchema: z.object({
    businessId: z.string(),
    action: z.enum([
      "update_lead_stage",
      "complete_follow_up",
      "record_activity",
    ]),
    leadId: z.string().optional(),
    followUpId: z.string().optional(),
    stage: z
      .enum(["new", "contacted", "qualified", "proposal", "won", "lost"])
      .optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    activityType: z.string().optional(),
  }),

  execute: async ({
    businessId,
    action,
    leadId,
    followUpId,
    stage,
    title,
    description,
    activityType,
  }) => {
    if (action === "update_lead_stage") {
      if (!leadId || !stage) {
        return {
          success: false,
          error: "leadId and stage are required.",
        };
      }

      const result = await db
        .update(leads)
        .set({
          stage,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(leads.id, leadId),
            eq(leads.businessId, businessId),
          ),
        )
        .returning({
          id: leads.id,
          name: leads.name,
          stage: leads.stage,
        });

      if (!result[0]) {
        return {
          success: false,
          error: "Lead not found.",
        };
      }

      return {
        success: true,
        action,
        lead: result[0],
        message: `Lead moved to ${stage}.`,
      };
    }

    if (action === "complete_follow_up") {
      if (!followUpId) {
        return {
          success: false,
          error: "followUpId is required.",
        };
      }

      const result = await db
        .update(followUps)
        .set({
          status: "completed",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(followUps.id, followUpId),
            eq(followUps.businessId, businessId),
          ),
        )
        .returning({
          id: followUps.id,
          title: followUps.title,
          status: followUps.status,
        });

      if (!result[0]) {
        return {
          success: false,
          error: "Follow-up not found.",
        };
      }

      return {
        success: true,
        action,
        followUp: result[0],
        message: "Follow-up completed.",
      };
    }

    if (action === "record_activity") {
      if (!leadId || !title) {
        return {
          success: false,
          error: "leadId and title are required.",
        };
      }

      const lead = await db
        .select({
          id: leads.id,
          name: leads.name,
        })
        .from(leads)
        .where(
          and(
            eq(leads.id, leadId),
            eq(leads.businessId, businessId),
          ),
        )
        .limit(1);

      if (!lead[0]) {
        return {
          success: false,
          error: "Lead not found.",
        };
      }

      const activityId = crypto.randomUUID();

      await db.insert(salesActivities).values({
        id: activityId,
        businessId,
        leadId,
        employeeId: null,
        type: activityType || "sales_activity",
        title,
        description: description || null,
        createdAt: new Date(),
      });

      return {
        success: true,
        action,
        activityId,
        lead: lead[0],
        message: "Sales activity recorded.",
      };
    }

    return {
      success: false,
      error: "Unsupported Sales action.",
    };
  },
});
