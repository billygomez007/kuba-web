import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireMarketingFeature } from "./entitlement";
import { getActiveMarketingEmployeeId } from "./draft-store";

export const createMarketingTaskTool = createTool({
  id: "create-marketing-task",

  description:
    "Create an internal task for a marketing follow-up (content review, design request, campaign-review, launch preparation, approval reminder). Reuses the existing Business Operations tasks system — this does not create a separate marketing task backend.",

  inputSchema: z.object({
    title: z.string(),
    description: z.string().optional(),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
    dueAt: z.string().optional().describe("ISO 8601 date/time."),
    leadId: z.string().optional(),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const employeeId = await getActiveMarketingEmployeeId(gate.businessId);
    if (!employeeId) {
      return { success: false, error: "No active Marketing AI employee was found for this business." };
    }

    let dueAt: Date | null = null;
    if (input.dueAt) {
      const parsed = new Date(input.dueAt);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: "The provided due date is invalid." };
      }
      dueAt = parsed;
    }

    const now = new Date();
    const id = crypto.randomUUID();

    await db.insert(tasks).values({
      id,
      businessId: gate.businessId,
      title: input.title,
      description: input.description || null,
      status: "pending",
      priority: input.priority,
      assignedEmployeeId: employeeId,
      leadId: input.leadId || null,
      dueAt,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      taskId: id,
      message: "Marketing task created.",
    };
  },
});
