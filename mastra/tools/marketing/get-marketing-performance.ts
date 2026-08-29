import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { requireMarketingFeature } from "./entitlement";

/**
 * There is no connected ad platform, marketing-email provider, or campaign
 * analytics store in this codebase (see MARKETING_AI_EMPLOYEE_REPORT.md).
 * This tool exists so the agent has something to call instead of guessing —
 * it always returns "not connected" rather than fabricating metrics such as
 * CTR, CPC, ROAS, or conversion rate.
 */
export const getMarketingPerformanceTool = createTool({
  id: "get-marketing-performance",

  description:
    "Check whether real campaign performance data (ad spend, CTR, conversions, ROAS, email/social analytics) is connected for this business. Always use this before discussing campaign performance — never estimate or invent these numbers.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    return {
      success: true,
      connected: false,
      message:
        "Campaign performance data is not currently connected. No ad platform, marketing-email provider, or analytics integration is linked to this business, so CTR, CPC, CPM, ROAS, ROI, and conversion rate cannot be reported.",
      availableInstead: [
        "Lead and follow-up pipeline data (use getGrowthOpportunities or getLeads).",
        "Customer record counts and recency (use getCustomerSummary).",
      ],
    };
  },
});
