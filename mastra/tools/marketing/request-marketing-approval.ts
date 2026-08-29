import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { requireMarketingFeature } from "./entitlement";
import { getActiveMarketingEmployeeId } from "./draft-store";

/**
 * The ONLY path from a marketing draft to any external send. This never
 * sends anything itself — it only records a pending approval, exactly like
 * mastra/tools/sales-external-action.ts does for Sales. Publishing a social
 * post, sending bulk WhatsApp/SMS/email, or spending ad budget must never be
 * reachable any other way from this agent.
 */
export const requestMarketingApprovalTool = createTool({
  id: "request-marketing-approval",

  description:
    "Request human approval before any external marketing action (sending a bulk message, publishing a post, sending a promotional email). This tool never sends or publishes anything itself — it only creates a pending approval request for a human to review.",

  inputSchema: z.object({
    channel: z.enum(["whatsapp", "sms", "email", "facebook", "instagram", "linkedin", "tiktok", "x"]),
    recipient: z.string().describe("Recipient, segment name, or 'all customers' — describe the audience, do not assume it was resolved."),
    message: z.string().min(1),
  }),

  execute: async ({ channel, recipient, message }, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const employeeId = await getActiveMarketingEmployeeId(gate.businessId);
    const approvalId = crypto.randomUUID();
    const now = new Date();

    await db.insert(actionApprovals).values({
      id: approvalId,
      businessId: gate.businessId,
      employeeId,
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
      messageToUser: `Approval requested for this ${channel} action. Approval ID: ${approvalId}. Nothing has been sent.`,
    };
  },
});
