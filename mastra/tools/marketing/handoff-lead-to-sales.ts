import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, followUps, aiEmployees, aiEmployeeActivities } from "@/db/schema";
import { requireMarketingFeature } from "./entitlement";
import { getActiveMarketingEmployeeId } from "./draft-store";

export const handoffLeadToSalesTool = createTool({
  id: "handoff-lead-to-sales",

  description:
    "Hand off a qualified lead from Marketing to Sales with structured context (campaign source, interest, engagement, suggested talking point). Creates a follow-up assigned to the active Sales AI employee — it does not message the customer.",

  inputSchema: z.object({
    leadName: z.string(),
    campaignSource: z.string().optional(),
    leadInterest: z.string(),
    recentEngagement: z.string().optional(),
    suggestedTalkingPoint: z.string(),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const businessId = gate.businessId;

    const matchingLeads = await db
      .select({ id: leads.id, name: leads.name })
      .from(leads)
      .where(and(eq(leads.businessId, businessId), eq(leads.name, input.leadName)))
      .limit(1);

    const lead = matchingLeads[0];
    if (!lead) {
      return { success: false, error: `No lead named "${input.leadName}" was found in this business.` };
    }

    const salesEmployee = await db
      .select({ id: aiEmployees.id })
      .from(aiEmployees)
      .where(and(eq(aiEmployees.businessId, businessId), eq(aiEmployees.type, "sales"), eq(aiEmployees.status, "active")))
      .limit(1);

    const assignedEmployeeId = salesEmployee[0]?.id || null;

    const handoffContext = [
      input.campaignSource ? `Campaign source: ${input.campaignSource}` : null,
      `Lead interest: ${input.leadInterest}`,
      input.recentEngagement ? `Recent engagement: ${input.recentEngagement}` : null,
      `Suggested talking point: ${input.suggestedTalkingPoint}`,
    ]
      .filter(Boolean)
      .join("\n");

    const now = new Date();
    const followUpId = crypto.randomUUID();

    await db.insert(followUps).values({
      id: followUpId,
      businessId,
      leadId: lead.id,
      assignedEmployeeId,
      title: `Marketing handoff: ${lead.name}`,
      description: handoffContext,
      dueAt: now,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    const marketingEmployeeId = await getActiveMarketingEmployeeId(businessId);
    if (marketingEmployeeId) {
      await db.insert(aiEmployeeActivities).values({
        id: crypto.randomUUID(),
        businessId,
        employeeId: marketingEmployeeId,
        type: "marketing.lead.handoff",
        title: `Handed off ${lead.name} to Sales`,
        description: handoffContext,
        status: "completed",
        createdAt: now,
      });
    }

    return {
      success: true,
      followUpId,
      leadId: lead.id,
      assignedToSalesEmployee: Boolean(assignedEmployeeId),
      message: assignedEmployeeId
        ? "Lead handed off to Sales with structured context."
        : "Lead handoff recorded, but there is no active Sales AI employee to assign it to yet.",
    };
  },
});
