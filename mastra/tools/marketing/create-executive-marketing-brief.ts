import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, followUps, customers, actionApprovals, tasks } from "@/db/schema";
import { requireBusinessId } from "@/mastra/tools/business-context";
import { requireMarketingFeature } from "./entitlement";
import { computeGrowthOpportunities } from "./get-growth-opportunities";
import { getActiveMarketingEmployeeId } from "./draft-store";

export const createExecutiveMarketingBriefTool = createTool({
  id: "create-executive-marketing-brief",

  description:
    "Produce an executive-style marketing brief (what happened, new opportunities, leads requiring attention, approvals waiting, recommended next actions) built entirely from real business data.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingAdvanced");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const businessId = requireBusinessId(requestContext);

    const [leadRows, followUpRows, customerRows, pendingApprovals, marketingTasks] = await Promise.all([
      db
        .select({
          id: leads.id,
          name: leads.name,
          service: leads.service,
          stage: leads.stage,
          source: leads.source,
          createdAt: leads.createdAt,
          updatedAt: leads.updatedAt,
        })
        .from(leads)
        .where(eq(leads.businessId, businessId)),
      db
        .select({ id: followUps.id, leadId: followUps.leadId, status: followUps.status, dueAt: followUps.dueAt })
        .from(followUps)
        .where(eq(followUps.businessId, businessId)),
      db.select({ id: customers.id, updatedAt: customers.updatedAt }).from(customers).where(eq(customers.businessId, businessId)),
      db
        .select({ id: actionApprovals.id, channel: actionApprovals.channel })
        .from(actionApprovals)
        .where(and(eq(actionApprovals.businessId, businessId), eq(actionApprovals.status, "pending"))),
      (async () => {
        const employeeId = await getActiveMarketingEmployeeId(businessId);
        if (!employeeId) return [];
        return db
          .select({ id: tasks.id, title: tasks.title, status: tasks.status, dueAt: tasks.dueAt })
          .from(tasks)
          .where(and(eq(tasks.businessId, businessId), eq(tasks.assignedEmployeeId, employeeId), eq(tasks.status, "pending")));
      })(),
    ]);

    const opportunities = computeGrowthOpportunities(leadRows, followUpRows, customerRows);

    const stageBreakdown: Record<string, number> = {};
    for (const lead of leadRows) {
      stageBreakdown[lead.stage] = (stageBreakdown[lead.stage] || 0) + 1;
    }

    return {
      success: true,
      generatedAt: new Date().toISOString(),
      pipeline: {
        totalLeads: leadRows.length,
        stageBreakdown,
        totalCustomers: customerRows.length,
      },
      newOpportunities: opportunities,
      approvalsWaiting: pendingApprovals,
      contentAndTasksDue: marketingTasks,
      note:
        "This brief reflects only data currently available in the platform. Campaign performance metrics are not included because no ad or campaign-analytics integration is connected.",
    };
  },
});
