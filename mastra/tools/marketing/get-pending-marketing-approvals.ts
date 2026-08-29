import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { requireBusinessId } from "@/mastra/tools/business-context";
import { requireMarketingFeature } from "./entitlement";

export const getPendingMarketingApprovalsTool = createTool({
  id: "get-pending-marketing-approvals",

  description:
    "List marketing external-action requests that are waiting for human approval (e.g. a requested WhatsApp/SMS/email send). Use this when the user asks what is waiting for approval or what Marketing is blocked on.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const businessId = requireBusinessId(requestContext);

    const pending = await db
      .select({
        id: actionApprovals.id,
        channel: actionApprovals.channel,
        recipient: actionApprovals.recipient,
        message: actionApprovals.message,
        status: actionApprovals.status,
        createdAt: actionApprovals.createdAt,
      })
      .from(actionApprovals)
      .where(and(eq(actionApprovals.businessId, businessId), eq(actionApprovals.status, "pending")))
      .orderBy(desc(actionApprovals.createdAt));

    return {
      success: true,
      count: pending.length,
      pendingApprovals: pending,
    };
  },
});
