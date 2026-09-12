import { hasCapability } from "@/lib/billing/plan-definitions";
import { isEmployeeImplementationAvailable, isEmployeeTypeEntitled } from "@/lib/billing/ai-workforce-policy";
import type { BusinessEntitlements } from "@/lib/billing/entitlements";

/**
 * Campaign Engine access, integrated with the centralized AI Workforce
 * policy (lib/billing/ai-workforce-policy.ts) and plan capabilities
 * (lib/billing/plan-definitions.ts) — no second, parallel entitlement
 * framework, and no scattered `if (plan === "pro")` checks in routes.
 */

export const CAMPAIGN_CHANNELS = ["email", "whatsapp"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

/**
 * Implementation availability per channel, independent of plan — mirrors
 * the same two-dimensional pattern as employee-type availability. WhatsApp
 * campaigns are commercially conceivable but not yet implemented: approved
 * templates, Meta initiation rules, consent, policy checks, and rate
 * controls are not built (see CURRENT_STATE.md). Being on a high-enough
 * plan must never be enough to launch a channel that isn't real yet.
 */
const CHANNEL_IMPLEMENTED: Record<CampaignChannel, boolean> = {
  email: true,
  whatsapp: false,
};

export function isCampaignChannelAvailable(channel: string): boolean {
  return CHANNEL_IMPLEMENTED[channel as CampaignChannel] ?? false;
}

export type CampaignPolicyCode =
  | "OUTREACH_NOT_ENTITLED"
  | "OUTREACH_NOT_AVAILABLE"
  | "CAMPAIGNS_NOT_ENTITLED"
  | "CHANNEL_NOT_AVAILABLE";

export type CampaignPolicyDecision =
  | { allowed: true }
  | { allowed: false; code: CampaignPolicyCode; message: string };

/**
 * Can this workspace launch a campaign on the given channel? Layers the
 * campaign-specific "outreach.campaigns" capability on top of the
 * workspace's existing entitlement to the Outreach employee type itself —
 * a business must already be able to use Outreach at all before it can use
 * campaigns, exactly as campaigns are a deeper capability within Outreach,
 * not a separate product surface.
 */
export function canUseCampaigns(
  entitlements: BusinessEntitlements,
  channel: string,
): CampaignPolicyDecision {
  if (!isEmployeeTypeEntitled(entitlements, "outreach")) {
    return {
      allowed: false,
      code: "OUTREACH_NOT_ENTITLED",
      message: "Outreach campaigns require the Pro plan or higher.",
    };
  }

  if (!isEmployeeImplementationAvailable("outreach")) {
    return {
      allowed: false,
      code: "OUTREACH_NOT_AVAILABLE",
      message: "Outreach is not yet available.",
    };
  }

  if (!hasCapability(entitlements, "outreach.campaigns")) {
    return {
      allowed: false,
      code: "CAMPAIGNS_NOT_ENTITLED",
      message: "Outreach campaigns require the Pro plan or higher.",
    };
  }

  if (!isCampaignChannelAvailable(channel)) {
    return {
      allowed: false,
      code: "CHANNEL_NOT_AVAILABLE",
      message: `The ${channel} channel is not yet available for campaigns.`,
    };
  }

  return { allowed: true };
}
