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

function normalizeDomain(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

function authoritativeSourceTier(
  sourceType?: string,
  requestedTier?: number,
) {
  const normalized = sourceType
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_");

  if (
    [
      "official_website",
      "government_registry",
      "government",
      "regulator",
      "official_procurement",
      "stock_exchange_filing",
      "court_record",
      "official_press_release",
    ].includes(normalized || "")
  ) {
    return 1;
  }

  if (
    [
      "news",
      "established_news",
      "industry_publication",
      "research_organization",
      "professional_database",
    ].includes(normalized || "")
  ) {
    return 2;
  }

  if (
    [
      "wikipedia",
      "linkedin",
      "directory",
      "marketplace",
      "aggregator",
      "business_listing",
    ].includes(normalized || "")
  ) {
    return 3;
  }

  if (
    [
      "social_post",
      "anonymous_page",
      "scraped_directory",
      "unsourced_claim",
      "petition",
      "low_quality_lead_database",
    ].includes(normalized || "")
  ) {
    return 4;
  }

  return requestedTier ?? null;
}

export const saveOutreachEvidenceTool = createTool({
  id: "save-outreach-evidence",

  description:
    "Save evidence, research findings, and buying signals for an existing Outreach prospect belonging to the current business. Only save findings supported by real research or business-provided information. Never invent sources, URLs, claims, or buying signals.",

  inputSchema: z.object({
    prospectId: z
      .string()
      .min(1)
      .describe(
        "The Outreach prospect ID returned by the prospect-saving or prospect-retrieval capability.",
      ),

    findingType: z
      .string()
      .min(1)
      .describe(
        "The type of finding, such as company_identity, industry, location, product, hiring, expansion, customer_service, procurement, leadership, contact, or other.",
      ),

    claim: z
      .string()
      .min(1)
      .describe(
        "The concise research finding or claim supported by the source.",
      ),

    classification: z
      .enum([
        "confirmed",
        "likely_inference",
        "unknown",
      ])
      .describe(
        "Whether the finding is confirmed, a likely inference, or unknown.",
      ),

    sourceUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "The exact public source URL supporting the finding, when available.",
      ),

    sourceTitle: z
      .string()
      .optional()
      .describe(
        "The page, document, article, or source title when available.",
      ),

    sourceTier: z
      .number()
      .int()
      .min(1)
      .max(4)
      .optional()
      .describe(
        "Source quality tier: 1 authoritative/first-party, 2 high-quality independent, 3 directory/secondary, 4 weak/unverified.",
      ),

    sourceType: z
      .string()
      .optional()
      .describe(
        "The source type, such as official_website, government_registry, regulator, news, industry_publication, linkedin, directory, marketplace, social_post, or user_provided.",
      ),

    buyingSignalType: z
      .string()
      .optional()
      .describe(
        "Optional buying signal category, such as expansion, hiring, customer_service_pressure, digital_transformation, procurement, funding, product_launch, leadership_change, or new_channel.",
      ),

    buyingSignalStrength: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe(
        "How strongly the evidence supports the buying signal.",
      ),

    observedAt: z
      .string()
      .datetime()
      .optional()
      .describe(
        "When the event or evidence was observed, as an ISO datetime when known.",
      ),
  }),

  outputSchema: z.union([
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
    z.object({
      success: z.literal(true),
      evidence: z
        .object({
          id: z.string(),
          prospectId: z.string(),
        })
        .passthrough(),
      prospect: z.object({
        id: z.string(),
        companyName: z.string(),
      }),
    }),
  ]),

  execute: async (
    {
      prospectId,
      findingType,
      claim,
      classification,
      sourceUrl,
      sourceTitle,
      sourceTier,
      sourceType,
      buyingSignalType,
      buyingSignalStrength,
      observedAt,
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

    const now = new Date();
    const evidenceId = crypto.randomUUID();

    const saved = (
      await db
        .insert(outreachResearchEvidence)
        .values({
          id: evidenceId,
          businessId,
          prospectId: prospect.id,
          employeeId,

          findingType: findingType.trim(),
          claim: claim.trim(),
          classification,

          sourceUrl: sourceUrl?.trim() || null,
          sourceDomain:
            normalizeDomain(sourceUrl) || null,
          sourceTitle:
            sourceTitle?.trim() || null,

          sourceTier:
            authoritativeSourceTier(
              sourceType,
              sourceTier,
            ),
          sourceType:
            sourceType?.trim() || null,

          buyingSignalType:
            buyingSignalType?.trim() || null,
          buyingSignalStrength:
            buyingSignalType?.trim()
              ? buyingSignalStrength || null
              : null,

          observedAt: observedAt
            ? new Date(observedAt)
            : null,

          createdAt: now,
        })
        .returning()
    )[0];

    await db
      .update(outreachProspects)
      .set({
        researchStatus: "researched",
        lastResearchedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(outreachProspects.id, prospect.id),
          eq(outreachProspects.businessId, businessId),
        ),
      );

    await createAuditLog({
      businessId,
      userId: null,
      action: "ai.outreach.evidence.created",
      resource: "outreach_research_evidence",
      resourceId: evidenceId,
      description: `Kuba Outreach saved research evidence for "${prospect.companyName}".`,
      metadata: {
        prospectId: prospect.id,
        classification,
        sourceTier:
          authoritativeSourceTier(
            sourceType,
            sourceTier,
          ),
        sourceDomain:
          normalizeDomain(sourceUrl),
        buyingSignalType:
          buyingSignalType || null,
        buyingSignalStrength:
          buyingSignalType
            ? buyingSignalStrength || null
            : null,
      },
    });

    return {
      success: true as const,
      evidence: saved,
      prospect: {
        id: prospect.id,
        companyName: prospect.companyName,
      },
    };
  },
});
