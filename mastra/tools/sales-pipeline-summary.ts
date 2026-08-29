import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, followUps } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

export const salesPipelineSummaryTool = createTool({
  id: "sales-pipeline-summary",

  description:
    "Analyze the current sales pipeline for the business. Use this when the user asks for a pipeline summary, sales overview, lead breakdown, opportunities, or which leads need attention.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_leads" });
    if (!decision.ok) return { totalLeads: 0, stageCounts: {}, qualifiedLeads: [], convertedLeads: [], pendingFollowUps: 0, completedFollowUps: 0, overdueFollowUps: [], upcomingFollowUps: [], error: decision.message };
    const businessLeads = await db
      .select({
        id: leads.id,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        source: leads.source,
        stage: leads.stage,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(eq(leads.businessId, businessId));

    const businessFollowUps = await db
      .select({
        id: followUps.id,
        leadId: followUps.leadId,
        title: followUps.title,
        dueAt: followUps.dueAt,
        status: followUps.status,
      })
      .from(followUps)
      .where(eq(followUps.businessId, businessId));

    const stageCounts = businessLeads.reduce<
      Record<string, number>
    >((counts, lead) => {
      const stage = lead.stage || "unknown";

      counts[stage] = (counts[stage] || 0) + 1;

      return counts;
    }, {});

    const pendingFollowUps = businessFollowUps.filter(
      (followUp) => followUp.status === "pending",
    );

    const completedFollowUps = businessFollowUps.filter(
      (followUp) => followUp.status === "completed",
    );

    const now = new Date();

    const overdueFollowUps = pendingFollowUps.filter(
      (followUp) => new Date(followUp.dueAt) < now,
    );

    const upcomingFollowUps = pendingFollowUps.filter(
      (followUp) => new Date(followUp.dueAt) >= now,
    );

    const qualifiedLeads = businessLeads.filter(
      (lead) => lead.stage === "qualified",
    );

    const convertedLeads = businessLeads.filter(
      (lead) => lead.stage === "converted",
    );

    return {
      totalLeads: businessLeads.length,

      stageCounts,

      qualifiedLeads: qualifiedLeads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        stage: lead.stage,
      })),

      convertedLeads: convertedLeads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        stage: lead.stage,
      })),

      pendingFollowUps: pendingFollowUps.length,

      completedFollowUps: completedFollowUps.length,

      overdueFollowUps: overdueFollowUps.map((followUp) => ({
        id: followUp.id,
        leadId: followUp.leadId,
        title: followUp.title,
        dueAt: followUp.dueAt,
      })),

      upcomingFollowUps: upcomingFollowUps.map((followUp) => ({
        id: followUp.id,
        leadId: followUp.leadId,
        title: followUp.title,
        dueAt: followUp.dueAt,
      })),
    };
  },
});