import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { leads } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

export const getLeadsTool = createTool({
  id: "get-leads",

  description:
    "Retrieve leads belonging to the current business. Use this when the user asks to see, list, review, analyze, or find leads in the sales pipeline.",

  inputSchema: z.object({
    stage: z
      .string()
      .optional()
      .describe(
        "Optional lead stage to filter by, such as new, contacted, qualified, or converted.",
      ),
  }),

  execute: async ({ stage }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_leads" });
    if (!decision.ok) return { leads: [], count: 0, error: decision.message };
    const conditions = stage
      ? and(
          eq(leads.businessId, businessId),
          eq(leads.stage, stage),
        )
      : eq(leads.businessId, businessId);

    const results = await db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
        assignedEmployeeId: leads.assignedEmployeeId,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(conditions);

    return {
      leads: results,
      count: results.length,
    };
  },
});