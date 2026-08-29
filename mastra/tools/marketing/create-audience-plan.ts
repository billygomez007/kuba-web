import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";
import { saveMarketingDraft } from "./draft-store";

const SENSITIVE_TERMS = [
  "race",
  "ethnicity",
  "ethnic",
  "religion",
  "religious",
  "politic",
  "sexual orientation",
  "lgbt",
  "gay",
  "lesbian",
  "transgender",
  "medical condition",
  "disability",
  "disabled",
  "pregnan",
  "hiv",
  "mental health",
  "immigration status",
  "criminal record",
];

export type AudienceSegmentInput = { name: string; definition: string; rationale: string };

/**
 * Pure guard so it can be unit tested without a database. Flags a segment
 * whose definition or rationale references a protected characteristic —
 * these must never be used for targeting per the Marketing AI job description.
 */
export function findSensitiveSegments(segments: AudienceSegmentInput[]): AudienceSegmentInput[] {
  return segments.filter((segment) => {
    const haystack = `${segment.definition} ${segment.rationale}`.toLowerCase();
    return SENSITIVE_TERMS.some((term) => haystack.includes(term));
  });
}

export const createAudiencePlanTool = createTool({
  id: "create-audience-plan",

  description:
    "Propose audience segments using only lawful, available business data (leads, customers, engagement, location, funnel stage). Never infer or target using protected characteristics such as race, religion, or sexual orientation.",

  inputSchema: z.object({
    segments: z
      .array(
        z.object({
          name: z.string(),
          definition: z.string().describe("How this segment is identified from real business data."),
          rationale: z.string(),
        }),
      )
      .min(1),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const sensitive = findSensitiveSegments(input.segments);
    if (sensitive.length > 0) {
      return {
        success: false,
        error:
          "One or more segments appear to target a protected characteristic (e.g. race, religion, sexual orientation, medical status). Kuba does not create audience segments based on sensitive personal traits.",
        rejectedSegments: sensitive.map((segment) => segment.name),
      };
    }

    const result = await saveMarketingDraft({
      businessId: gate.businessId,
      type: "marketing.audience_plan.created",
      title: "Audience segmentation plan",
      draft: { segments: input.segments, status: "draft" },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: "draft",
      draftId: result.draftId,
      segments: input.segments,
      message: "Audience plan created as a draft based on lawful business data only.",
    };
  },
});
