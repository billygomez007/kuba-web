export type MarketingCampaignStatus = "draft" | "planned" | "pending_approval" | "approved" | "scheduled" | "active" | "paused" | "completed" | "cancelled";

const transitions: Record<MarketingCampaignStatus, MarketingCampaignStatus[]> = {
  draft: ["planned", "pending_approval", "cancelled"], planned: ["draft", "pending_approval", "cancelled"], pending_approval: ["draft", "approved", "cancelled"], approved: ["scheduled", "cancelled"], scheduled: ["active", "paused", "cancelled"], active: ["paused", "completed", "cancelled"], paused: ["active", "completed", "cancelled"], completed: [], cancelled: [],
};
export function assertCampaignTransition(from: string, to: string): void { if (from === to) return; if (!(transitions[from as MarketingCampaignStatus] ?? []).includes(to as MarketingCampaignStatus)) throw new Error(`Invalid campaign transition: ${from} -> ${to}`); }
