import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * There is no connected ad platform or campaign-analytics provider in this
 * system. This tool exists so the agent has something concrete to call
 * before discussing performance metrics, and always returns the honest
 * "not connected" answer rather than letting the model estimate or invent
 * CTR/CPC/CPM/ROAS/conversion numbers. No tenant data is read here — there
 * is deliberately nothing to scope by business, since nothing is stored.
 */
export const getMarketingPerformanceTool = createTool({
  id: "get-marketing-performance",

  description:
    "Check whether campaign performance data (CTR, CPC, CPM, ROAS, conversion rate) is available. Always call this before discussing performance metrics.",

  inputSchema: z.object({}),

  execute: async () => {
    return {
      connected: false,
      message:
        "Campaign performance data is not currently connected. No ad platform or analytics provider is linked to this business.",
    };
  },
});
