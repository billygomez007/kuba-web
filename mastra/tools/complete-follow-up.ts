import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { followUps, leads } from "@/db/schema";

export const completeFollowUpTool = createTool({
  id: "complete-follow-up",

  description:
    "Mark a pending follow-up belonging to the current business as completed. ONLY use this tool when the user explicitly confirms that the follow-up was actually completed, such as saying they called, messaged, emailed, spoke with, contacted, or otherwise completed the follow-up. NEVER use this tool merely because the user says 'do it', 'go ahead', 'handle it', or approves a recommended action. Those phrases do not prove that the customer interaction occurred.",

  inputSchema: z.object({
    businessId: z
      .string()
      .describe("The ID of the business that owns the follow-up."),

    followUpId: z
      .string()
      .optional()
      .describe("The follow-up ID, if known."),

    leadName: z
      .string()
      .optional()
      .describe(
        "The name of the lead whose follow-up should be completed.",
      ),
  }),

  execute: async ({
    businessId,
    followUpId,
    leadName,
  }) => {
    let targetFollowUpId = followUpId;

    if (!targetFollowUpId && leadName) {
      const matchingFollowUps = await db
        .select({
          followUpId: followUps.id,
        })
        .from(followUps)
        .innerJoin(
          leads,
          eq(followUps.leadId, leads.id),
        )
        .where(
          and(
            eq(followUps.businessId, businessId),
            eq(leads.name, leadName),
            eq(followUps.status, "pending"),
          ),
        )
        .limit(1);

      targetFollowUpId =
        matchingFollowUps[0]?.followUpId;
    }

    if (!targetFollowUpId) {
      return {
        success: false,
        error:
          "The pending follow-up could not be found.",
      };
    }

    const existingFollowUp = await db
      .select({
        id: followUps.id,
        leadId: followUps.leadId,
        title: followUps.title,
        status: followUps.status,
      })
      .from(followUps)
      .where(
        and(
          eq(followUps.id, targetFollowUpId),
          eq(followUps.businessId, businessId),
        ),
      )
      .limit(1);

    if (existingFollowUp.length === 0) {
      return {
        success: false,
        error: "Follow-up not found.",
      };
    }

    if (existingFollowUp[0].status === "completed") {
      return {
        success: false,
        error: "This follow-up is already completed.",
      };
    }

    const updatedFollowUp = await db
      .update(followUps)
      .set({
        status: "completed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(followUps.id, targetFollowUpId),
          eq(followUps.businessId, businessId),
        ),
      )
      .returning({
        id: followUps.id,
        leadId: followUps.leadId,
        title: followUps.title,
        status: followUps.status,
      });

    return {
      success: true,
      followUp: updatedFollowUp[0],
    };
  },
});