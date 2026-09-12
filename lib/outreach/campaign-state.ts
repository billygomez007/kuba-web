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
 * only from "running" — confirmed campaign-level-only: a campaign may
 * enter "failed" only when campaign-level execution cannot safely
 * continue (corrupted/inconsistent campaign configuration, missing
 * required sending configuration, an irrecoverable orchestration failure,
 * an invariant violation). A single recipient's or send's failure is a
 * recipient/send-level outcome and must NEVER, by itself, transition the
 * campaign to "failed" — see lib/outreach/recipient-state.ts and
 * lib/outreach/send-worker.ts, which handle those independently.
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
