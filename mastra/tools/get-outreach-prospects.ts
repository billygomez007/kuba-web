import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq, like } from "drizzle-orm";

import { db } from "@/db";
import { outreachProspects } from "@/db/schema";
import { requireBusinessId } from "./business-context";

function normalizeDomain(value?: string) {
  if (!value?.trim()) return null;

  try {
    const url = new URL(
      value.startsWith("http://") || value.startsWith("https://")
        ? value
        : `https://${value}`,
    );

    return url.hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return value
      .trim()
      .toLowerCase()
      .replace(/^www\./, "");
  }
}

export const getOutreachProspectsTool = createTool({
  id: "get-outreach-prospects",

  description:
    "Find existing Outreach prospects belonging to the current business. Use this before claiming that a prospect does not exist, and before saving evidence, contacts, qualification, or Sales handoff data when the prospect ID is not already known.",

  inputSchema: z.object({
    companyName: z
      .string()
      .optional()
      .describe("Company name to search for."),

    domain: z
      .string()
      .optional()
      .describe(
        "Official company domain or website, such as openai.com.",
      ),

    prospectId: z
      .string()
      .optional()
      .describe("Known Outreach prospect ID."),

    qualificationStatus: z
      .string()
      .optional()
      .describe(
        "Optional qualification status filter.",
      ),
  }),

  execute: async (
    {
      companyName,
      domain,
      prospectId,
      qualificationStatus,
    },
    { requestContext },
  ) => {
    const businessId = requireBusinessId(requestContext);

    if (prospectId) {
      const result = await db
        .select()
        .from(outreachProspects)
        .where(
          and(
            eq(outreachProspects.businessId, businessId),
            eq(outreachProspects.id, prospectId),
          ),
        )
        .limit(1);

      return {
        prospects: result,
        count: result.length,
      };
    }

    const normalizedDomain = normalizeDomain(domain);

    if (normalizedDomain) {
      const result = await db
        .select()
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
        .limit(20);

      return {
        prospects: result,
        count: result.length,
      };
    }

    if (companyName?.trim()) {
      const result = await db
        .select()
        .from(outreachProspects)
        .where(
          and(
            eq(outreachProspects.businessId, businessId),
            like(
              outreachProspects.companyName,
              `%${companyName.trim()}%`,
            ),
          ),
        )
        .limit(20);

      return {
        prospects: result,
        count: result.length,
      };
    }

    if (qualificationStatus?.trim()) {
      const result = await db
        .select()
        .from(outreachProspects)
        .where(
          and(
            eq(outreachProspects.businessId, businessId),
            eq(
              outreachProspects.qualificationStatus,
              qualificationStatus.trim(),
            ),
          ),
        )
        .limit(50);

      return {
        prospects: result,
        count: result.length,
      };
    }

    const result = await db
      .select()
      .from(outreachProspects)
      .where(
        eq(outreachProspects.businessId, businessId),
      )
      .limit(50);

    return {
      prospects: result,
      count: result.length,
    };
  },
});
