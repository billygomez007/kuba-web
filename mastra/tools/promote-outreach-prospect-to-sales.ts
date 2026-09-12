import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiEmployees,
  outreachProspects,
  outreachResearchEvidence,
} from "@/db/schema";
import {
  requireBusinessId,
  requireEmployeeId,
} from "./business-context";
import { promoteProspectToSales } from "@/lib/outreach/sales-handoff";

export const promoteOutreachProspectToSalesTool = createTool({
  id: "promote-outreach-prospect-to-sales",

  description:
    "Promote an already-qualified Outreach prospect into the current business's Sales pipeline. Only use this after qualification. Nurture, unqualified, or disqualified prospects must never be promoted. This creates or returns one Sales lead and records the Outreach-to-Sales handoff.",

  inputSchema: z.object({
    prospectId: z
      .string()
      .min(1)
      .describe("The qualified Outreach prospect ID."),

    recommendedNextAction: z
      .string()
      .min(10)
      .max(1500)
      .describe(
        "A concise recommended next action for Sales, grounded in the saved research and qualification.",
      ),
  }),

  execute: async (
    {
      prospectId,
      recommendedNextAction,
    },
    { requestContext },
  ) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    /*
     * These preconditions are specific to AUTONOMOUS, AI-initiated
     * promotion. They are deliberately NOT part of the shared handoff core
     * (lib/outreach/sales-handoff.ts) — a campaign-reply-triggered handoff
     * (lib/outreach/campaign-reply-handoff.ts) is a different trigger with
     * direct engagement evidence of its own, and is not forced through an
     * ICP-score rule that exists for the passive research-qualification
     * path.
     */
    const prospect = (
      await db
        .select({
          id: outreachProspects.id,
          companyName: outreachProspects.companyName,
          employeeId: outreachProspects.employeeId,
          researchStatus: outreachProspects.researchStatus,
          qualificationStatus: outreachProspects.qualificationStatus,
          icpFitScore: outreachProspects.icpFitScore,
          qualificationReason: outreachProspects.qualificationReason,
          promotedLeadId: outreachProspects.promotedLeadId,
        })
        .from(outreachProspects)
        .where(
          and(
            eq(outreachProspects.id, prospectId),
            eq(outreachProspects.businessId, businessId),
          ),
        )
        .limit(1)
    )[0];

    if (!prospect) {
      return {
        success: false,
        error: "Outreach prospect not found for the current business.",
      };
    }

    if (prospect.employeeId !== employeeId) {
      return {
        success: false,
        error: "This prospect does not belong to the active Outreach employee.",
      };
    }

    if (prospect.promotedLeadId) {
      // Delegate to the shared core purely to return the existing lead
      // consistently with every other code path — this call is a no-op
      // read since promotedLeadId is already set.
      const result = await promoteProspectToSales({
        businessId,
        prospectId,
        employeeId,
        reason: { type: "autonomous_research_qualification", icpFitScore: prospect.icpFitScore ?? 0, qualificationReason: prospect.qualificationReason },
        recommendedNextAction,
      });
      return result.success
        ? { success: true, created: false, deduplicated: true, alreadyPromoted: true, lead: result.lead }
        : result;
    }

    /*
     * AUTHORITY GATE
     *
     * Qualification can happen autonomously, but handing a prospect to
     * Sales is a further commercial commitment. It may only happen
     * autonomously when the business has explicitly configured this
     * Outreach employee's autonomy to "autonomous" via the existing
     * AI-employee supervision-mode settings
     * (app/api/ai-employees/[id]/permissions/route.ts). Any other mode
     * (the "owner_supervised" default, "assistant", or "operator") leaves
     * the prospect qualified-and-ready but requires a human to promote it.
     */
    const outreachEmployee = (
      await db
        .select({ supervisionMode: aiEmployees.supervisionMode })
        .from(aiEmployees)
        .where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, businessId)))
        .limit(1)
    )[0];

    if (outreachEmployee?.supervisionMode !== "autonomous") {
      return {
        success: false,
        error:
          "Sales promotion requires this Outreach employee's autonomy to be set to \"autonomous\" in AI employee settings. The prospect remains qualified; promote it manually or update the employee's autonomy level.",
        code: "PROMOTION_REQUIRES_AUTONOMY",
      };
    }

    if (prospect.qualificationStatus !== "qualified") {
      return {
        success: false,
        error: `Only qualified prospects can be promoted to Sales. Current status: ${prospect.qualificationStatus}.`,
      };
    }

    if (prospect.icpFitScore === null || prospect.icpFitScore < 70) {
      return {
        success: false,
        error: "Sales promotion requires an ICP fit score of at least 70.",
      };
    }

    if (prospect.researchStatus !== "researched") {
      return {
        success: false,
        error: "Sales promotion requires completed prospect research.",
      };
    }

    const evidenceCount = (
      await db
        .select({ id: outreachResearchEvidence.id })
        .from(outreachResearchEvidence)
        .where(
          and(
            eq(outreachResearchEvidence.businessId, businessId),
            eq(outreachResearchEvidence.prospectId, prospectId),
            eq(outreachResearchEvidence.employeeId, employeeId),
          ),
        )
    ).length;

    if (evidenceCount === 0) {
      return {
        success: false,
        error: "Sales promotion requires saved Outreach research evidence.",
      };
    }

    const result = await promoteProspectToSales({
      businessId,
      prospectId,
      employeeId,
      reason: {
        type: "autonomous_research_qualification",
        icpFitScore: prospect.icpFitScore,
        qualificationReason: prospect.qualificationReason,
      },
      recommendedNextAction,
    });

    if (!result.success) return result;

    return result.deduplicated
      ? { success: true, created: false, deduplicated: true, alreadyPromoted: true, lead: result.lead }
      : { success: true, created: true, deduplicated: false, alreadyPromoted: false, lead: result.lead };
  },
});
