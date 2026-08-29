import type { RequestContext } from "@mastra/core/request-context";

import { getBusinessPlan, canUseFeature, type BillingFeature } from "@/lib/billing/entitlements";
import { requireBusinessId } from "@/mastra/tools/business-context";

/**
 * Marketing tools sit behind the same plan entitlements already declared for
 * Marketing AI ("marketingBasic" at Growth+, "marketingAdvanced" at Pro+).
 * Reused here rather than inventing a new gate — see lib/billing/entitlements.ts.
 */
export async function requireMarketingFeature(
  requestContext: RequestContext,
  feature: Extract<BillingFeature, "marketingBasic" | "marketingAdvanced">,
): Promise<{ businessId: string; allowed: true } | { businessId: string; allowed: false; message: string }> {
  const businessId = requireBusinessId(requestContext);
  const plan = await getBusinessPlan(businessId);

  if (canUseFeature(plan, feature)) {
    return { businessId, allowed: true };
  }

  const requiredPlan = feature === "marketingAdvanced" ? "Pro" : "Growth";

  return {
    businessId,
    allowed: false,
    message: `This Marketing AI capability requires the ${requiredPlan} plan or higher.`,
  };
}
