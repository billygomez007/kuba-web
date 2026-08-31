import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachProspects } from "@/db/schema";
import {
  requireBusinessId,
  requireEmployeeId,
} from "./business-context";
import { createAuditLog } from "@/lib/auth/audit";

function normalizeCompanyName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeDomain(value?: string) {
  if (!value?.trim()) {
    return null;
  }

  const raw = value.trim();

  try {
    const url = new URL(
      raw.startsWith("http://") || raw.startsWith("https://")
        ? raw
        : `https://${raw}`,
    );

    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return null;
  }
}

export const saveOutreachProspectTool = createTool({
  id: "save-outreach-prospect",

  description:
    "Save a researched or discovered organization into the current business's Outreach prospect database. Use this only for real organizations supported by research or business-provided information. The business and AI employee identities come from trusted server context and must never be supplied by the model.",

  inputSchema: z.object({
    companyName: z
      .string()
      .min(1)
      .describe("The verified or researched organization name."),

    website: z
      .string()
      .optional()
      .describe(
        "The organization's official or likely official website when supported by evidence.",
      ),

    industry: z
      .string()
      .optional()
      .describe("The organization's industry when known."),

    country: z
      .string()
      .optional()
      .describe("The organization's country when known."),

    city: z
      .string()
      .optional()
      .describe("The organization's city when known."),

    description: z
      .string()
      .optional()
      .describe(
        "A concise factual description of the organization.",
      ),

    discoverySource: z
      .string()
      .optional()
      .describe(
        "How the prospect was discovered, for example web_search, official_site, referral, user_provided, directory, or tender.",
      ),

    discoveryQuery: z
      .string()
      .optional()
      .describe(
        "The search or research query that led to this prospect.",
      ),
  }),

  outputSchema: z.union([
    z.object({
      success: z.literal(false),
      error: z.string(),
      code: z.literal("IDENTITY_CONFLICT"),
      conflict: z.object({
        existingProspectId: z.string(),
        existingCompanyName: z.string(),
        incomingCompanyName: z.string(),
        normalizedDomain: z.string().nullable(),
        promotedLeadId: z.string().nullable(),
      }),
    }),

    z.object({
      success: z.literal(true),
      created: z.boolean(),
      deduplicated: z.boolean(),
      prospect: z
        .object({
          id: z.string(),
        })
        .passthrough(),
    }),
  ]),

  execute: async (
    {
      companyName,
      website,
      industry,
      country,
      city,
      description,
      discoverySource,
      discoveryQuery,
    },
    { requestContext },
  ) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);

    const normalizedCompanyName =
      normalizeCompanyName(companyName);

    const normalizedDomain =
      normalizeDomain(website);

    /*
     * DEDUPLICATION
     *
     * Strongest identity signal: domain.
     *
     * If no domain is available, only deduplicate by company name when
     * additional geographic identity is available. This avoids merging
     * unrelated organizations that happen to share a name.
     */
    let existing:
      | {
          id: string;
          companyName: string;
          website: string | null;
          normalizedDomain: string | null;
          industry: string | null;
          country: string | null;
          city: string | null;
          normalizedCompanyName: string;
          promotedLeadId: string | null;
        }
      | undefined;

    if (normalizedDomain) {
      existing = (
        await db
          .select({
            id: outreachProspects.id,
            companyName: outreachProspects.companyName,
            website: outreachProspects.website,
            normalizedDomain: outreachProspects.normalizedDomain,
            industry: outreachProspects.industry,
            country: outreachProspects.country,
            city: outreachProspects.city,
            normalizedCompanyName:
              outreachProspects.normalizedCompanyName,
            promotedLeadId:
              outreachProspects.promotedLeadId,
          })
          .from(outreachProspects)
          .where(
            and(
              eq(outreachProspects.businessId, businessId),
              eq(
                outreachProspects.normalizedDomain,
                normalizedDomain,
              ),
            ),
          )
          .limit(1)
      )[0];
    }

    if (!existing && country?.trim()) {
      existing = (
        await db
          .select({
            id: outreachProspects.id,
            companyName: outreachProspects.companyName,
            website: outreachProspects.website,
            normalizedDomain: outreachProspects.normalizedDomain,
            industry: outreachProspects.industry,
            country: outreachProspects.country,
            city: outreachProspects.city,
            normalizedCompanyName:
              outreachProspects.normalizedCompanyName,
            promotedLeadId:
              outreachProspects.promotedLeadId,
          })
          .from(outreachProspects)
          .where(
            and(
              eq(outreachProspects.businessId, businessId),
              eq(
                outreachProspects.normalizedCompanyName,
                normalizedCompanyName,
              ),
              eq(outreachProspects.country, country.trim()),
            ),
          )
          .limit(1)
      )[0];
    }

    if (!existing && !country?.trim() && city?.trim()) {
      existing = (
        await db
          .select({
            id: outreachProspects.id,
            companyName: outreachProspects.companyName,
            website: outreachProspects.website,
            normalizedDomain: outreachProspects.normalizedDomain,
            industry: outreachProspects.industry,
            country: outreachProspects.country,
            city: outreachProspects.city,
            normalizedCompanyName:
              outreachProspects.normalizedCompanyName,
            promotedLeadId:
              outreachProspects.promotedLeadId,
          })
          .from(outreachProspects)
          .where(
            and(
              eq(outreachProspects.businessId, businessId),
              eq(
                outreachProspects.normalizedCompanyName,
                normalizedCompanyName,
              ),
              eq(outreachProspects.city, city.trim()),
            ),
          )
          .limit(1)
      )[0];
    }

    const now = new Date();

    if (
      existing &&
      existing.normalizedCompanyName !==
        normalizedCompanyName
    ) {
      await createAuditLog({
        businessId,
        userId: null,
        action:
          "ai.outreach.prospect.identity_conflict",
        resource: "outreach_prospect",
        resourceId: existing.id,
        description:
          `Kuba Outreach refused to merge "${companyName}" into existing prospect "${existing.companyName}" because their company identities conflict.`,
        metadata: {
          employeeId,
          existingCompanyName:
            existing.companyName,
          incomingCompanyName:
            companyName.trim(),
          existingNormalizedCompanyName:
            existing.normalizedCompanyName,
          incomingNormalizedCompanyName:
            normalizedCompanyName,
          normalizedDomain,
          promotedLeadId:
            existing.promotedLeadId,
        },
      });

      return {
        success: false as const,
        error:
          `Identity conflict: domain or other deduplication signals matched existing prospect "${existing.companyName}", but the incoming company name "${companyName.trim()}" does not match. Automatic merge was refused.`,
        code: "IDENTITY_CONFLICT" as const,
        conflict: {
          existingProspectId: existing.id,
          existingCompanyName:
            existing.companyName,
          incomingCompanyName:
            companyName.trim(),
          normalizedDomain:
            normalizedDomain ||
            existing.normalizedDomain ||
            null,
          promotedLeadId:
            existing.promotedLeadId,
        },
      };
    }

    if (existing) {
      const updated = (
        await db
          .update(outreachProspects)
          .set({
            employeeId,
            companyName:
              existing.companyName,
            normalizedCompanyName:
              existing.normalizedCompanyName,
            website:
              existing.website ||
              website?.trim() ||
              null,
            normalizedDomain:
              existing.normalizedDomain ||
              normalizedDomain ||
              null,
            industry:
              industry?.trim() ||
              existing.industry ||
              null,
            country:
              country?.trim() ||
              existing.country ||
              null,
            city:
              city?.trim() ||
              existing.city ||
              null,
            description:
              description?.trim() || undefined,
            discoverySource:
              discoverySource?.trim() || undefined,
            discoveryQuery:
              discoveryQuery?.trim() || undefined,
            updatedAt: now,
          })
          .where(
            and(
              eq(outreachProspects.id, existing.id),
              eq(outreachProspects.businessId, businessId),
            ),
          )
          .returning()
      )[0];

      await createAuditLog({
        businessId,
        userId: null,
        action: "ai.outreach.prospect.updated",
        resource: "outreach_prospect",
        resourceId: existing.id,
        description: `Kuba Outreach enriched prospect "${companyName}".`,
        metadata: {
          normalizedDomain,
          discoverySource: discoverySource || null,
        },
      });

      return {
        success: true as const,
        created: false as const,
        deduplicated: true as const,
        prospect: updated,
      };
    }

    const prospectId = crypto.randomUUID();

    const created = (
      await db
        .insert(outreachProspects)
        .values({
          id: prospectId,
          businessId,
          employeeId,

          companyName: companyName.trim(),
          normalizedCompanyName,

          website: website?.trim() || null,
          normalizedDomain,

          industry: industry?.trim() || null,
          country: country?.trim() || null,
          city: city?.trim() || null,
          description: description?.trim() || null,

          discoverySource:
            discoverySource?.trim() || null,
          discoveryQuery:
            discoveryQuery?.trim() || null,

          researchStatus: "discovered",
          qualificationStatus: "unqualified",

          icpFitScore: null,
          qualificationReason: null,

          promotedLeadId: null,
          lastResearchedAt: null,
          qualifiedAt: null,
          promotedAt: null,

          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];

    await createAuditLog({
      businessId,
      userId: null,
      action: "ai.outreach.prospect.created",
      resource: "outreach_prospect",
      resourceId: prospectId,
      description: `Kuba Outreach saved prospect "${companyName}".`,
      metadata: {
        normalizedDomain,
        discoverySource: discoverySource || null,
      },
    });

    return {
      success: true as const,
      created: true as const,
      deduplicated: false as const,
      prospect: created,
    };
  },
});
