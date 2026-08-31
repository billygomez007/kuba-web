import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  outreachProspects,
  outreachResearchEvidence,
} from "@/db/schema";
import {
  requireBusinessId,
  requireEmployeeId,
} from "./business-context";
import { createAuditLog } from "@/lib/auth/audit";

export const qualifyOutreachProspectTool = createTool({
  id: "qualify-outreach-prospect",

  description:
    "Qualify an existing researched Outreach prospect against the current business's ideal customer profile. Use evidence and trusted business context. Never fabricate fit, need, budget, authority, urgency, or buying intent. This tool records qualification only; it does not contact the prospect or promote it to Sales.",

  inputSchema: z.object({
    prospectId: z
      .string()
      .min(1)
      .describe("Existing Outreach prospect ID."),

    status: z
      .enum([
        "qualified",
        "nurture",
        "disqualified",
      ])
      .describe(
        "qualified means sufficiently strong fit for Sales consideration; nurture means potentially relevant but not ready or insufficiently evidenced; disqualified means the prospect is not a suitable fit.",
      ),

    icpFitScore: z
      .number()
      .int()
      .min(0)
      .max(100)
      .describe(
        "Evidence-based ICP fit score from 0 to 100. This is fit, not a fabricated probability of purchase.",
      ),

    reason: z
      .string()
      .min(20)
      .max(3000)
      .describe(
        "Evidence-based explanation for the qualification decision, including important unknowns. Do not present inference as confirmed fact.",
      ),
  }),

  outputSchema: z.union([
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
    z.object({
      success: z.literal(true),
      prospect: z
        .object({
          id: z.string(),
        })
        .passthrough(),
      qualification: z.object({
        status: z.enum([
          "qualified",
          "nurture",
          "disqualified",
        ]),
        icpFitScore: z.number().int().min(0).max(100),
        reason: z.string(),
        evidenceCount: z.number().int().nonnegative(),
        confirmedEvidenceCount:
          z.number().int().nonnegative(),
        strongEvidenceCount:
          z.number().int().nonnegative(),
        credibleBuyingSignalCount:
          z.number().int().nonnegative(),
      }),
    }),
  ]),

  execute: async (
    {
      prospectId,
      status,
      icpFitScore,
      reason,
    },
    { requestContext },
  ) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    const prospect = (
      await db
        .select({
          id: outreachProspects.id,
          companyName: outreachProspects.companyName,
          employeeId: outreachProspects.employeeId,
          researchStatus: outreachProspects.researchStatus,
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
        success: false as const,
        error:
          "Outreach prospect not found for the current business.",
      };
    }

    if (prospect.employeeId !== employeeId) {
      return {
        success: false as const,
        error:
          "This Outreach prospect does not belong to the active Outreach employee.",
      };
    }

    const evidence = await db
      .select({
        id: outreachResearchEvidence.id,
        classification:
          outreachResearchEvidence.classification,
        sourceTier: outreachResearchEvidence.sourceTier,
        buyingSignalType:
          outreachResearchEvidence.buyingSignalType,
      })
      .from(outreachResearchEvidence)
      .where(
        and(
          eq(
            outreachResearchEvidence.businessId,
            businessId,
          ),
          eq(
            outreachResearchEvidence.prospectId,
            prospectId,
          ),
          eq(
            outreachResearchEvidence.employeeId,
            employeeId,
          ),
        ),
      );

    if (evidence.length === 0) {
      return {
        success: false as const,
        error:
          "Qualification requires saved research evidence. Research the prospect and save evidence first.",
      };
    }

    const confirmedEvidenceCount = evidence.filter(
      (item) => item.classification === "confirmed",
    ).length;

    const strongEvidenceCount = evidence.filter(
      (item) =>
        item.classification === "confirmed" &&
        item.sourceTier !== null &&
        item.sourceTier <= 2,
    ).length;

    const buyingSignalEvidence = evidence.filter(
      (item) =>
        item.buyingSignalType &&
        item.classification === "confirmed" &&
        item.sourceTier !== null &&
        item.sourceTier <= 2,
    );

    const credibleBuyingSignalCount =
      buyingSignalEvidence.length;

    /*
     * Server-side qualification guardrails:
     *
     * 1. A qualified prospect must have authoritative/credible evidence.
     * 2. It must also have at least one confirmed Tier 1 or Tier 2
     *    buying-signal / addressable-need record.
     *
     * Generic company identity, industry, or capability overlap alone
     * can never satisfy the qualified threshold.
     */
    if (
      status === "qualified" &&
      strongEvidenceCount === 0
    ) {
      return {
        success: false as const,
        error:
          "A qualified prospect requires at least one confirmed Tier 1 or Tier 2 evidence record.",
      };
    }

    if (
      status === "qualified" &&
      credibleBuyingSignalCount === 0
    ) {
      return {
        success: false as const,
        error:
          "A qualified prospect requires at least one confirmed Tier 1 or Tier 2 buying-signal or addressable-need evidence record. Capability overlap alone is not sufficient.",
      };
    }

    /*
     * Server-side score/status consistency.
     * The model cannot mark a low-score prospect qualified or a
     * high-score prospect disqualified accidentally.
     */
    if (status === "qualified" && icpFitScore < 70) {
      return {
        success: false as const,
        error:
          "Qualified prospects require an ICP fit score of at least 70.",
      };
    }

    if (
      status === "nurture" &&
      (icpFitScore < 40 || icpFitScore > 69)
    ) {
      return {
        success: false as const,
        error:
          "Nurture prospects require an ICP fit score between 40 and 69.",
      };
    }

    if (
      status === "disqualified" &&
      icpFitScore > 39
    ) {
      return {
        success: false as const,
        error:
          "Disqualified prospects require an ICP fit score between 0 and 39.",
      };
    }

    const now = new Date();

    const updated = (
      await db
        .update(outreachProspects)
        .set({
          qualificationStatus: status,
          icpFitScore,
          qualificationReason: reason.trim(),
          qualifiedAt:
            status === "qualified" ? now : null,
          updatedAt: now,
        })
        .where(
          and(
            eq(outreachProspects.id, prospectId),
            eq(outreachProspects.businessId, businessId),
            eq(outreachProspects.employeeId, employeeId),
          ),
        )
        .returning()
    )[0];

    await createAuditLog({
      businessId,
      userId: null,
      action: "ai.outreach.prospect.qualified",
      resource: "outreach_prospect",
      resourceId: prospectId,
      description: `Kuba Outreach classified "${prospect.companyName}" as ${status}.`,
      metadata: {
        employeeId,
        status,
        icpFitScore,
        evidenceCount: evidence.length,
        confirmedEvidenceCount,
        strongEvidenceCount,
        credibleBuyingSignalCount,
        alreadyPromotedToSales:
          Boolean(prospect.promotedLeadId),
      },
    });

    return {
      success: true as const,
      prospect: updated,
      qualification: {
        status,
        icpFitScore,
        reason: reason.trim(),
        evidenceCount: evidence.length,
        confirmedEvidenceCount,
        strongEvidenceCount,
        credibleBuyingSignalCount,
      },
    };
  },
});
