import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";
import { saveMarketingDraft } from "./draft-store";

export const createCampaignBriefTool = createTool({
  id: "create-campaign-brief",

  description:
    "Create a structured campaign brief (draft only — this does not launch anything or spend money). Use this when the user asks for a campaign, campaign strategy, or campaign plan.",

  inputSchema: z.object({
    campaignName: z.string(),
    businessObjective: z.string(),
    targetAudience: z.string(),
    customerProblem: z.string(),
    offer: z.string().describe("Only include an offer the business has explicitly approved or provided. Do not invent discounts or prices."),
    positioning: z.string(),
    coreMessage: z.string(),
    supportingMessages: z.array(z.string()).default([]),
    channels: z.array(z.string()),
    cta: z.string(),
    contentAssetsRequired: z.array(z.string()).default([]),
    campaignDuration: z.string(),
    leadFollowUpStrategy: z.string(),
    salesHandoffStrategy: z.string(),
    kpis: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
    risks: z.array(z.string()).default([]),
    budgetRecommendation: z
      .string()
      .optional()
      .describe("Advisory only. Kuba never spends money automatically."),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingAdvanced");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const result = await saveMarketingDraft({
      businessId: gate.businessId,
      type: "marketing.campaign_draft.created",
      title: `Campaign brief: ${input.campaignName}`,
      draft: { ...input, approvalRequired: true, status: "draft" },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: "draft",
      draftId: result.draftId,
      campaignBrief: input,
      message:
        "Campaign brief created as a draft. It requires human review and approval before any channel activity, spend, or publishing occurs.",
    };
  },
});
