import { assertTransition } from "@/lib/state-transitions";

/**
 * Centralized recipient lifecycle. Unlike campaign states, no explicit
 * transition table was specified for recipients — this is a first-pass
 * design inferred from the approved state list and is expected to be
 * revisited. Not every recipient passes through every state (e.g. a
 * recipient can go straight from "pending" to "suppressed" without ever
 * being scheduled).
 */
export const RECIPIENT_STATUSES = [
  "pending",
  "ready",
  "scheduled",
  "in_progress",
  "sent",
  "replied",
  "interested",
  "handed_off",
  "completed",
  "suppressed",
  "opted_out",
  "failed",
  "stopped",
] as const;

export type RecipientStatus = (typeof RECIPIENT_STATUSES)[number];

export const recipientTransitions: Record<RecipientStatus, RecipientStatus[]> = {
  // Just enrolled; not yet checked against suppression/consent.
  pending: ["ready", "suppressed", "opted_out", "stopped"],
  // Passed eligibility checks; eligible for the next step to be scheduled.
  ready: ["scheduled", "suppressed", "opted_out", "stopped"],
  // A send job exists for the current step and is due.
  scheduled: ["in_progress", "suppressed", "opted_out", "stopped"],
  // A worker has claimed the current step's send.
  in_progress: ["sent", "failed", "stopped"],
  // Current step delivered; loops back for the next step, or completes if
  // that was the last step in the sequence.
  sent: ["ready", "replied", "completed", "suppressed", "opted_out", "stopped"],
  // An inbound reply was received — can happen at any point after a send.
  replied: ["interested", "handed_off", "completed", "stopped"],
  interested: ["handed_off", "completed", "stopped"],
  // Promoted through the existing Outreach -> Sales handoff.
  handed_off: ["completed", "stopped"],
  completed: [],
  suppressed: [],
  opted_out: [],
  failed: ["stopped"],
  stopped: [],
};

export function assertRecipientTransition(current: RecipientStatus, next: RecipientStatus) {
  assertTransition(recipientTransitions, current, next);
}
