import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireBusinessId } from "@/mastra/tools/business-context";
import { requireMarketingFeature } from "./entitlement";

export const getCustomerSummaryTool = createTool({
  id: "get-customer-summary",

  description:
    "Retrieve real customer records and a summary breakdown by source for the current business. Use this before recommending audience segments, reactivation campaigns, or customer-based marketing.",

  inputSchema: z.object({}),

  execute: async (_input, { requestContext }) => {
    const gate = await requireMarketingFeature(requestContext, "marketingBasic");
    if (!gate.allowed) {
      return { success: false, error: gate.message };
    }

    const businessId = requireBusinessId(requestContext);

    const records = await db
      .select({
        id: customers.id,
        name: customers.name,
        email: customers.email,
        phone: customers.phone,
        source: customers.source,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(eq(customers.businessId, businessId));

    const bySource: Record<string, number> = {};
    for (const customer of records) {
      const key = customer.source || "unknown";
      bySource[key] = (bySource[key] || 0) + 1;
    }

    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    const recentlyActive = records.filter(
      (customer) => now - new Date(customer.updatedAt).getTime() <= thirtyDaysMs,
    ).length;

    const dormant = records.filter(
      (customer) => now - new Date(customer.updatedAt).getTime() > ninetyDaysMs,
    ).length;

    return {
      success: true,
      totalCustomers: records.length,
      bySource,
      recentlyActive,
      dormant,
      customers: records,
    };
  },
});
