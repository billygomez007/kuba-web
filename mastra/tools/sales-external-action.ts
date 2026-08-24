import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { requireBusinessId } from "./business-context";

export const salesExternalActionTool = createTool({
  id: "sales-external-action",

  description:
    "Prepare an external customer communication for approval. Never send an external message without approval.",

  inputSchema: z.object({
    channel: z.enum([
      "whatsapp",
      "sms",
      "email",
    ]),

    recipient: z.string(),

    message: z.string().min(1),
  }),

  execute: async ({
    channel,
    recipient,
    message,
  }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const approvalId = crypto.randomUUID();
    const now = new Date();

    await db.insert(actionApprovals).values({
      id: approvalId,
      businessId,
      employeeId: null,
      channel,
      recipient,
      message,
      status: "pending",
      createdAt: now,
      updatedAt: now,
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
