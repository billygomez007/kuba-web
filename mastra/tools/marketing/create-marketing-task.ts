import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createMarketingTaskInput = z.object({
  title: z.string().min(1).describe("A short, specific task title, e.g. \"Review Instagram carousel draft\"."),
  description: z
    .string()
    .optional()
    .describe("Additional context: what needs to happen and why."),
  priority: z
    .enum(["low", "normal", "high"])
    .optional()
    .describe("Defaults to normal if not specified."),
});

export async function performCreateMarketingTask(
  businessId: string,
  employeeId: string,
  { title, description, priority }: z.infer<typeof createMarketingTaskInput>,
) {
  const taskId = crypto.randomUUID();
  const now = new Date();

  const result = await db
    .insert(tasks)
    .values({
      id: taskId,
      businessId,
      title,
      description: description || null,
      status: "pending",
      priority: priority || "normal",
      assignedEmployeeId: employeeId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority });

  await createAuditLog({
    businessId,
    userId: null,
    action: "ai.marketing.create_task",
    resource: "task",
    resourceId: taskId,
    description: `Kuba Marketing created an internal task: "${title}".`,
    metadata: { employeeId },
  });

  return { success: true, task: result[0] };
}

/**
 * Internal coordination only — content review, design request, launch prep.
 * Never customer-facing; never sends anything. Distinct from
 * request_external_message, which is the only path that can ever touch a
 * real customer and always requires human approval.
 */
export const createMarketingTaskTool = createTool({
  id: "create-marketing-task",

  description:
    "Create a real internal task for follow-up work (content review, design request, launch prep). Use only when there is concrete follow-up work, not for every conversation.",

  inputSchema: createMarketingTaskInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({
      businessId,
      employeeId,
      action: "create_marketing_task",
    });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({
          businessId,
          employeeId,
          action: "create_marketing_task",
          payload: input,
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
    return performCreateMarketingTask(businessId, employeeId, input);
  },
});
