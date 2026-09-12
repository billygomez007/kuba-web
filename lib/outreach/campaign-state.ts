import { assertTransition } from "@/lib/state-transitions";

/**
 * Centralized campaign lifecycle. Never mutate outreach_campaigns.status
 * directly from a route or worker — always go through
 * assertCampaignTransition first, so an invalid transition fails loudly
 * instead of silently corrupting campaign state.
 */
export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "stopped",
  "failed",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/**
 * Only the transitions explicitly approved for v1. "failed" is reachable
 * only from "running" (a fatal system-level error partway through
 * execution) — this is the one transition not given as an explicit example
 * and is inferred only because "failed" would otherwise be an unreachable
 * terminal state; confirm before relying on it for anything user-facing.
 */
export const campaignTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["scheduled", "running"],
  scheduled: ["running", "stopped"],
  running: ["paused", "completed", "stopped", "failed"],
  paused: ["running", "stopped"],
  completed: [],
  stopped: [],
  failed: [],
};

export function assertCampaignTransition(current: CampaignStatus, next: CampaignStatus) {
  assertTransition(campaignTransitions, current, next);
}
