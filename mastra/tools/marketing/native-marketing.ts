import { createTool } from "@mastra/core/tools";
import { desc, eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { marketingCampaigns, marketingContentItems } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";

async function canRead(businessId: string, employeeId: string, action: "read_marketing_campaigns" | "read_marketing_content") {
  return checkAIEmployeeAuthority({ businessId, employeeId, action });
}

export const listMarketingCampaignsTool = createTool({
  id: "list-marketing-campaigns",
  description: "List native Marketing campaigns for the current business. This is internal planning data; it never publishes anything.",
  inputSchema: z.object({ status: z.string().optional() }),
  execute: async ({ status }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext); const employeeId = requireEmployeeId(requestContext); const decision = await canRead(businessId, employeeId, "read_marketing_campaigns"); if (!decision.ok) return { campaigns: [], error: decision.message };
    const where = status ? and(eq(marketingCampaigns.businessId, businessId), eq(marketingCampaigns.status, status)) : eq(marketingCampaigns.businessId, businessId);
    return { campaigns: await db.select().from(marketingCampaigns).where(where).orderBy(desc(marketingCampaigns.updatedAt)) };
  },
});

export const listMarketingContentTool = createTool({
  id: "list-marketing-content",
  description: "List native Marketing content drafts for the current business. Content remains subject to approval and provider availability.",
  inputSchema: z.object({ campaignId: z.string().optional() }),
  execute: async ({ campaignId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext); const employeeId = requireEmployeeId(requestContext); const decision = await canRead(businessId, employeeId, "read_marketing_content"); if (!decision.ok) return { content: [], error: decision.message };
    const where = campaignId ? and(eq(marketingContentItems.businessId, businessId), eq(marketingContentItems.campaignId, campaignId)) : eq(marketingContentItems.businessId, businessId);
    return { content: await db.select().from(marketingContentItems).where(where).orderBy(desc(marketingContentItems.updatedAt)) };
  },
});
