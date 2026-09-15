import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { tasks } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createHrTaskInput = z.object({
  title: z.string().min(1).describe("A short, specific task title, e.g. \"Send onboarding checklist to new hire\"."),
  description: z.string().optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export async function performCreateHrTask(
  businessId: string,
  employeeId: string,
  { title, description, priority }: z.infer<typeof createHrTaskInput>,
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
    action: "ai.hr.create_task",
    resource: "task",
    resourceId: taskId,
    description: `Kuba HR created an internal task: "${title}".`,
    metadata: { employeeId },
  });

  return { success: true, task: result[0] };
}

/**
 * Internal HR coordination only (onboarding steps, document reminders,
 * policy follow-ups). Kuba HR has no tool that hires, fires, disciplines,
 * changes compensation, or alters employment terms — those decisions stay
 * fully human-controlled and are not represented by any tool here.
 */
export const createHrTaskTool = createTool({
  id: "create-hr-task",

  description:
    "Create a real internal HR task (onboarding step, document reminder, policy follow-up). Never a hiring, firing, or compensation decision.",

  inputSchema: createHrTaskInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_hr_task" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_hr_task", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateHrTask(businessId, employeeId, input);
  },
});
