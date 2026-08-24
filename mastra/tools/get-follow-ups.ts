import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { followUps, leads } from "@/db/schema";
import { requireBusinessId } from "./business-context";

export const getFollowUpsTool = createTool({
  id: "get-follow-ups",

  description:
    "Retrieve follow-ups belonging to the current business. Use this when the user asks to see, list, review, or check pending, completed, or overdue follow-ups.",

  inputSchema: z.object({
    status: z
      .string()
      .optional()
      .describe(
        "Optional follow-up status such as pending or completed.",
      ),
  }),

  execute: async ({ status }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const conditions = status
      ? and(
          eq(followUps.businessId, businessId),
          eq(followUps.status, status),
        )
      : eq(followUps.businessId, businessId);

    const results = await db
      .select({
        id: followUps.id,
        leadId: followUps.leadId,
        leadName: leads.name,
        title: followUps.title,
        description: followUps.description,
        dueAt: followUps.dueAt,
        status: followUps.status,
        createdAt: followUps.createdAt,
      })
      .from(followUps)
      .leftJoin(
        leads,
        eq(followUps.leadId, leads.id),
      )
      .where(conditions);

    return {
      followUps: results,
      count: results.length,
    };
  },
});