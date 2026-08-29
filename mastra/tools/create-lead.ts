import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { leads, aiEmployees } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";

const createLeadInput = z.object({
  name: z
    .string()
    .min(1)
    .describe("The lead's full name."),

  email: z
    .string()
    .email()
    .optional()
    .describe("The lead's email address, if available."),

  phone: z
    .string()
    .optional()
    .describe("The lead's phone number, if available."),

  source: z
    .string()
    .optional()
    .describe(
      "Where the lead came from, such as website, WhatsApp, referral, Facebook, or Instagram.",
    ),
});

export async function performCreateLead(businessId: string, employeeId: string, { name, email, phone, source }: z.infer<typeof createLeadInput>) {
  const leadId = crypto.randomUUID();
  const now = new Date();

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
    .insert(leads)
    .values({
      id: leadId,
      businessId,
      name,
      email: email || null,
      phone: phone || null,
      source: source || null,
      stage: "new",
      assignedEmployeeId,
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      phone: leads.phone,
      source: leads.source,
      stage: leads.stage,
    });

  await createAuditLog({ businessId, userId: null, action: "ai.sales.create_lead", resource: "lead", resourceId: leadId, description: `Kuba Sales created lead "${name}".`, metadata: { source: source || null, employeeId } });

  return {
    success: true,
    lead: result[0],
  };
}

export const createLeadTool = createTool({
  id: "create-lead",

  description:
    "Create a new lead for the current business. Use this when the user asks to add, create, save, or register a new lead.",

  inputSchema: createLeadInput,

  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_lead" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_lead", payload: input });
        return { success: true, status: "approval_required", approvalId, messageToUser: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateLead(businessId, employeeId, input);
  },
});
