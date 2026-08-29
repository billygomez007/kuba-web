import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

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
    const employeeId = requireEmployeeId(requestContext);

    // Communication always resolves to "requires_approval" — see the
    // COMMUNICATION_FLOOR in lib/ai/authority.ts. This call still matters:
    // it verifies tenant ownership, employee-active status, and entitlement
    // before a pending approval is ever filed, and produces an audit trail
    // consistent with every other tool action.
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "request_external_message" });
    if (!decision.ok && decision.reason === "denied") {
      return { success: false, error: decision.message };
    }

    const approvalId = crypto.randomUUID();
    const now = new Date();

    await db.insert(actionApprovals).values({
      id: approvalId,
      businessId,
      employeeId,
      channel,
      recipient,
      message,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog({ businessId, userId: null, action: "ai.request_external_message", resource: "action_approval", resourceId: approvalId, description: `AI employee requested approval to message ${recipient} via ${channel}.`, metadata: { employeeId, channel } });

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
