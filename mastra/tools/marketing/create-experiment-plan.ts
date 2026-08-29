import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";
import { saveMarketingDraft } from "./draft-store";

export const createExperimentPlanTool = createTool({
  id: "create-experiment-plan",

  description:
    "Create an A/B test / experiment plan (e.g. subject line, headline, offer, CTA, landing page copy). This never claims results — results can only be reported once real data exists.",

  inputSchema: z.object({
    experimentName: z.string(),
    hypothesis: z.string(),
    variable: z.string(),
    control: z.string(),
    variant: z.string(),
    primaryMetric: z.string(),
    durationRecommendation: z.string(),
    successCondition: z.string(),
  }),

  execute: async (input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingAdvanced");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const result = await saveMarketingDraft({
      businessId: gate.businessId,
      type: "marketing.experiment_plan.created",
      title: `Experiment plan: ${input.experimentName}`,
      draft: { ...input, status: "draft", resultsAvailable: false },
    });

    if (!result.success) {
      return result;
    }

    return {
      success: true,
      status: "draft",
      draftId: result.draftId,
      experiment: input,
      message: "Experiment plan created. No results exist yet — this plan does not claim any outcome.",
    };
  },
});
