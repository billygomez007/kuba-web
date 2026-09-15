import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createFinanceTaskInput = z.object({
  title: z.string().min(1).describe("A short, specific task title, e.g. \"Review Q3 payroll spend vs budget\"."),
  description: z.string().optional().describe("Additional context, including any scenario/estimate assumptions used."),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export async function performCreateFinanceTask(
  businessId: string,
  employeeId: string,
  { title, description, priority }: z.infer<typeof createFinanceTaskInput>,
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
    action: "ai.finance.create_task",
    resource: "task",
    resourceId: taskId,
    description: `Kuba Finance created an internal task: "${title}".`,
    metadata: { employeeId },
  });

  return { success: true, task: result[0] };
}

/**
 * Internal recommendation/follow-up only. Kuba Finance has no tool that
 * transfers money, approves a purchase, or executes an investment — those
 * capabilities do not exist anywhere in this system.
 */
export const createFinanceTaskTool = createTool({
  id: "create-finance-task",

  description:
    "Create a real internal task or recommendation for management (budget review, forecast follow-up). Never executes a financial transaction.",

  inputSchema: createFinanceTaskInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_finance_task" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_finance_task", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateFinanceTask(businessId, employeeId, input);
  },
});
