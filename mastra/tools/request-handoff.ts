import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { performAiHandoff, performHumanEscalation } from "@/lib/communications/handoff";
import type { ChannelName } from "@/lib/communications/channel-policy";
import { readChannel, readConversationId, requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";

const requestHandoffInput = z.object({
  intent: z
    .enum(["sales", "support", "appointment", "receptionist", "human"])
    .describe("What kind of help the conversation needs next. The platform resolves this to a real, eligible employee — never choose an employee ID."),
  reason: z.string().min(1).describe("A short, honest reason for the handoff, e.g. \"Customer wants to book a demo.\""),
});

/**
 * The only way an AI employee can move a live customer conversation to
 * another employee or to a human. The model supplies semantic intent only —
 * never a businessId, employeeId, or conversationId — all of which are
 * resolved from the trusted server-side request context, per the platform's
 * routing-safety requirement. Reuses the exact conversationRouting/
 * conversations/handoffs write shape the existing human-triggered handoff
 * routes already use, so every existing reader (Inbox, Handoffs page,
 * employee dashboards) sees this with no changes.
 */
export const requestHandoffTool = createTool({
  id: "request-handoff",

  description:
    "Hand this live conversation to another AI employee (sales, support, appointment, receptionist) or escalate it to a human. You choose only an intent and a reason — the platform resolves the real destination and enforces tenant, plan, and channel eligibility. Only use this for a real, ongoing customer conversation, not for internal coordination (use a create-*-task tool for that).",

  inputSchema: requestHandoffInput,

  execute: async ({ intent, reason }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const conversationId = readConversationId(requestContext);
    const channel = readChannel(requestContext) as ChannelName;

    if (!conversationId) {
      return {
        success: false,
        error: "This session has no trackable customer conversation to hand off.",
      };
    }

    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "request_handoff" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({
          businessId,
          employeeId,
          action: "request_handoff",
          payload: { intent, reason, conversationId },
        });
        return {
          success: true,
          status: "approval_required",
          approvalId,
          messageToUser: `Approval requested. Approval ID: ${approvalId}`,
        };
      }
      return { success: false, error: decision.message };
    }

    if (intent === "human") {
      return performHumanEscalation({ businessId, conversationId, fromEmployeeId: employeeId, reason });
    }

    return performAiHandoff({ businessId, conversationId, fromEmployeeId: employeeId, intent, channel, reason });
  },
});
