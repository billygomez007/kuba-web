import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { followUps, leads, aiEmployees } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createFollowUpInput = z.object({
  leadName: z
    .string()
    .describe("The exact name of the lead."),

  title: z
    .string()
    .describe("A short title for the follow-up."),

  description: z
    .string()
    .optional()
    .describe("Additional details about the follow-up."),

  dueAt: z
    .string()
    .describe("The follow-up date and time in ISO 8601 format."),
});

export async function performCreateFollowUp(businessId: string, employeeId: string, { leadName, title, description, dueAt }: z.infer<typeof createFollowUpInput>) {
  const matchingLeads = await db
    .select({
      id: leads.id,
      name: leads.name,
    })
    .from(leads)
    .where(
      and(
        eq(leads.businessId, businessId),
        eq(leads.name, leadName),
      ),
    )
    .limit(1);

  if (matchingLeads.length === 0) {
    return {
      success: false,
      error: `No lead named "${leadName}" was found in this business.`,
    };
  }

  const lead = matchingLeads[0];

  const parsedDueAt = new Date(dueAt);

  if (Number.isNaN(parsedDueAt.getTime())) {
    return {
      success: false,
      error: "The follow-up date is invalid.",
    };
  }

  const now = new Date();
  const followUpId = crypto.randomUUID();

  const salesEmployee = await db
    .select({
      id: aiEmployees.id,
    })
    .from(aiEmployees)
    .where(
      and(
        eq(aiEmployees.businessId, businessId),
        eq(aiEmployees.type, "sales"),
        eq(aiEmployees.status, "active"),
      ),
    )
    .limit(1);

  const assignedEmployeeId =
    salesEmployee[0]?.id || null;

  const result = await db
    .insert(followUps)
    .values({
      id: followUpId,
      businessId,
      leadId: lead.id,
      assignedEmployeeId,
      title,
      description: description || null,
      dueAt: parsedDueAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: followUps.id,
      leadId: followUps.leadId,
      title: followUps.title,
      description: followUps.description,
      dueAt: followUps.dueAt,
      status: followUps.status,
    });

  await createAuditLog({ businessId, userId: null, action: "ai.sales.create_follow_up", resource: "follow_up", resourceId: followUpId, description: `Kuba Sales created follow-up "${title}" for lead "${lead.name}".`, metadata: { leadId: lead.id, dueAt: parsedDueAt.toISOString(), employeeId } });

  return {
    success: true,
    followUp: result[0],
    lead,
  };
}

export const createFollowUpTool = createTool({
  id: "create-follow-up",

  description:
    "Create a follow-up for a lead belonging to the current business. Use this when the user asks to create, schedule, or set a follow-up.",

  inputSchema: createFollowUpInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_follow_up" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_follow_up", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateFollowUp(businessId, employeeId, input);
  },
});
