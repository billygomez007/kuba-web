import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createAccountingTaskInput = z.object({
  title: z.string().min(1).describe("A short, specific task title, e.g. \"Reconcile October payroll run\"."),
  description: z.string().optional().describe("Additional context for the human accountant."),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export async function performCreateAccountingTask(
  businessId: string,
  employeeId: string,
  { title, description, priority }: z.infer<typeof createAccountingTaskInput>,
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
    action: "ai.accountant.create_task",
    resource: "task",
    resourceId: taskId,
    description: `Kuba Accountant created an internal task: "${title}".`,
    metadata: { employeeId },
  });

  return { success: true, task: result[0] };
}

/**
 * Internal-only, never a financial-record mutation itself — a task for a
 * human to reconcile, review, or file. Kuba Accountant has no tool that
 * moves money, changes a subscription, or edits a financial record.
 */
export const createAccountingTaskTool = createTool({
  id: "create-accounting-task",

  description:
    "Create a real internal task for a human accountant (reconciliation, review, filing prep). Never moves money or edits a financial record.",

  inputSchema: createAccountingTaskInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_accounting_task" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_accounting_task", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateAccountingTask(businessId, employeeId, input);
  },
});
