import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createOperationsTaskInput = z.object({
  title: z.string().min(1).describe("A short, specific task title, e.g. \"Follow up on overdue delivery for order #204\"."),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
  dueAt: z.string().optional().describe("ISO date/time this task is due, if known."),
});

export async function performCreateOperationsTask(
  businessId: string,
  employeeId: string,
  { title, description, priority, dueAt }: z.infer<typeof createOperationsTaskInput>,
) {
  const taskId = crypto.randomUUID();
  const now = new Date();
  const parsedDueAt = dueAt ? new Date(dueAt) : null;
  if (dueAt && (!parsedDueAt || Number.isNaN(parsedDueAt.getTime()))) {
    throw new Error("dueAt must be a valid date/time.");
  }

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
      dueAt: parsedDueAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: tasks.id, title: tasks.title, status: tasks.status, priority: tasks.priority });

  await createAuditLog({
    businessId,
    userId: null,
    action: "ai.operations.create_task",
    resource: "task",
    resourceId: taskId,
    description: `Kuba Operations created an internal task: "${title}".`,
    metadata: { employeeId },
  });

  return { success: true, task: result[0] };
}

export const createOperationsTaskTool = createTool({
  id: "create-operations-task",

  description: "Create a real internal operational task (follow-up, handoff, coordination).",

  inputSchema: createOperationsTaskInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_operations_task" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_operations_task", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateOperationsTask(businessId, employeeId, input);
  },
});
