import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, followUps } from "@/db/schema";

export const prioritizeLeadsTool = createTool({
  id: "prioritize-leads",

  description:
    "Identify which leads deserve the most attention based on their sales stage, follow-up status, and age in the pipeline. Use this when the user asks which leads to prioritize, who to contact first, or what sales opportunities need attention.",

  inputSchema: z.object({
    businessId: z
      .string()
      .describe("The ID of the business whose leads should be prioritized."),
  }),

  execute: async ({ businessId }) => {
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

    const now = new Date();

    const prioritizedLeads = businessLeads.map((lead) => {
      let score = 0;
      const reasons: string[] = [];

      if (lead.stage === "qualified") {
        score += 40;
        reasons.push("Lead is qualified.");
      } else if (lead.stage === "contacted") {
        score += 25;
        reasons.push("Lead has already been contacted.");
      } else if (lead.stage === "new") {
        score += 15;
        reasons.push("Lead is new and has not yet progressed.");
      }

      const leadFollowUps = businessFollowUps.filter(
        (followUp) => followUp.leadId === lead.id,
      );

      const pendingFollowUps = leadFollowUps.filter(
        (followUp) => followUp.status === "pending",
      );

      const overdueFollowUps = pendingFollowUps.filter(
        (followUp) => new Date(followUp.dueAt) < now,
      );

      if (overdueFollowUps.length > 0) {
        score += 50;
        reasons.push("Lead has an overdue follow-up.");
      } else if (pendingFollowUps.length > 0) {
        score += 30;
        reasons.push("Lead has a pending follow-up.");
      }

      const createdAt = new Date(lead.createdAt);
      const ageInDays =
        (now.getTime() - createdAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (ageInDays >= 7) {
        score += 10;
        reasons.push("Lead has been in the pipeline for more than 7 days.");
      }

      return {
        id: lead.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        stage: lead.stage,
        score,
        reasons,
        pendingFollowUps: pendingFollowUps.length,
        overdueFollowUps: overdueFollowUps.length,
      };
    });

    prioritizedLeads.sort((a, b) => b.score - a.score);

    return {
      totalLeads: prioritizedLeads.length,
      prioritizedLeads,
    };
  },
});