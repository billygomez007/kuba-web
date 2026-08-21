import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { createPendingAIAction } from "@/lib/ai/security";

export const salesExternalActionTool = createTool({
  id: "sales-external-action",

  description:
    "Prepare an external customer communication for approval. Never send an external message without approval.",

  inputSchema: z.object({
    businessId: z.string(),

    channel: z.enum([
      "whatsapp",
      "sms",
      "email",
    ]),

    recipient: z.string(),

    message: z.string().min(1),
  }),

  execute: async ({
    businessId,
    channel,
    recipient,
    message,
  }) => {
    const employee = (await db.select({ id: aiEmployees.id })
      .from(aiEmployees)
      .where(and(
        eq(aiEmployees.businessId, businessId),
        eq(aiEmployees.type, "sales"),
        eq(aiEmployees.status, "active"),
      ))
      .limit(1))[0];

    if (!employee) {
      return { success: false, error: "No active Sales AI employee is available for this business." };
    }

    const { id: approvalId } = await createPendingAIAction({
      businessId,
      employeeId: employee.id,
      channel,
      recipient,
      message,
    });

    return {
      success: true,
      status: "approval_required",
      approvalId,
      channel,
      recipient,
      message,
      messageToUser:
        `Approval requested. Approval ID: ${approvalId}`,
    };
  },
});
