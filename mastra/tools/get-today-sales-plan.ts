import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { leads, followUps } from "@/db/schema";
import { requireBusinessId } from "./business-context";

export const getTodaySalesPlanTool = createTool({
  id: "get-today-sales-plan",

  description:
    "Create a deterministic sales work plan for today using the current business leads and follow-ups. Use this whenever the user asks what they should work on today, what they should do today, what their sales priorities are today, or what needs their attention today.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
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
        description: followUps.description,
        dueAt: followUps.dueAt,
        status: followUps.status,
      })
      .from(followUps)
      .where(eq(followUps.businessId, businessId));

    const now = new Date();

    const priorities = businessLeads.map((lead) => {
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

      const ageInDays =
        (now.getTime() -
          new Date(lead.createdAt).getTime()) /
        (1000 * 60 * 60 * 24);

      if (ageInDays >= 7) {
        score += 10;
        reasons.push(
          "Lead has been in the pipeline for more than 7 days.",
        );
      }

      let action = "Review this lead and determine the next sales step.";

      if (overdueFollowUps.length > 0) {
        action =
          "Complete the overdue customer follow-up after the actual interaction occurs.";
      } else if (pendingFollowUps.length > 0) {
        action =
          "Handle the pending follow-up after the actual customer interaction occurs.";
      } else if (lead.stage === "qualified") {
        action =
          "Follow up with the qualified lead and determine the next step in the opportunity.";
      } else if (lead.stage === "contacted") {
        action =
          "Continue the sales conversation and determine the next stage.";
      } else if (lead.stage === "new") {
        action =
          "Contact and qualify the new lead.";
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
        action,
        pendingFollowUps: pendingFollowUps.length,
        overdueFollowUps: overdueFollowUps.length,
      };
    });

    priorities.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      return (a.name || "").localeCompare(b.name || "");
    });

    const pendingFollowUps = businessFollowUps.filter(
      (followUp) => followUp.status === "pending",
    );

    const overdueFollowUps = pendingFollowUps.filter(
      (followUp) => new Date(followUp.dueAt) < now,
    );

    const upcomingFollowUps = pendingFollowUps.filter(
      (followUp) => new Date(followUp.dueAt) >= now,
    );

    const stageCounts = businessLeads.reduce<
      Record<string, number>
    >((counts, lead) => {
      const stage = lead.stage || "unknown";
      counts[stage] = (counts[stage] || 0) + 1;
      return counts;
    }, {});

    const actionableLeads = priorities.filter(
      (lead) => lead.score > 0,
    );

    const topPriorities = actionableLeads.slice(0, 3);

    const nextBestLead = topPriorities[0] || null;

    return {
      success: true,

      generatedAt: now.toISOString(),

      totalLeads: businessLeads.length,

      stageCounts,

      followUps: {
        pending: pendingFollowUps.length,
        overdue: overdueFollowUps.length,
        upcoming: upcomingFollowUps.length,

        overdueItems: overdueFollowUps.map((followUp) => ({
          id: followUp.id,
          leadId: followUp.leadId,
          title: followUp.title,
          description: followUp.description,
          dueAt: followUp.dueAt,
        })),

        upcomingItems: upcomingFollowUps.map((followUp) => ({
          id: followUp.id,
          leadId: followUp.leadId,
          title: followUp.title,
          description: followUp.description,
          dueAt: followUp.dueAt,
        })),
      },

      priorities: topPriorities,

      nextBestAction: nextBestLead
        ? {
            leadId: nextBestLead.id,
            leadName: nextBestLead.name,
            stage: nextBestLead.stage,
            reason: nextBestLead.reasons.join(" "),
            action: nextBestLead.action,
          }
        : null,
    };
  },
});
