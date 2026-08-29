import { describe, it, expect } from "vitest";

import { getKubaAgent } from "@/lib/communications/ai-agent-registry";
import { kubaMarketingAgent, marketingTools } from "@/mastra/agents/marketing";
import { kubaSalesAgent } from "@/mastra/agents/sales";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { kubaCustomerSupportAgent } from "@/mastra/agents/customer-support";

describe("Marketing agent registration", () => {
  it("registers under the canonical 'marketing' employee type", () => {
    expect(getKubaAgent("marketing")).toBe(kubaMarketingAgent);
  });

  it("does not change resolution for existing employee types", () => {
    expect(getKubaAgent("sales")).toBe(kubaSalesAgent);
    expect(getKubaAgent("receptionist")).toBe(kubaReceptionistAgent);
    expect(getKubaAgent("customer_support")).toBe(kubaCustomerSupportAgent);
  });

  it("exposes the expected marketing tool surface, classified by authority", () => {
    const toolNames = Object.keys(marketingTools);
    // READ
    expect(toolNames).toContain("getGrowthOpportunities");
    expect(toolNames).toContain("getMarketingPerformance");
    expect(toolNames).toContain("getPendingMarketingApprovals");
    // DRAFT
    expect(toolNames).toContain("createCampaignBrief");
    expect(toolNames).toContain("createContentDraft");
    // INTERNAL_CREATE
    expect(toolNames).toContain("createMarketingTask");
    expect(toolNames).toContain("handoffLeadToSales");
    // APPROVAL_REQUIRED
    expect(toolNames).toContain("requestMarketingApproval");
    // EXTERNAL_ACTION tools must never be present — no publish/send/spend tool exists.
    const forbidden = ["publishSocialPost", "sendBulkEmail", "sendBulkWhatsApp", "sendBulkSms", "spendAdBudget", "launchAd"];
    for (const name of forbidden) {
      expect(toolNames).not.toContain(name);
    }
  });
});
