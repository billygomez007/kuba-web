import { and, asc, eq, lt, lte, or } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignSends } from "@/db/schema";

/**
 * Database-backed durable job queue for campaign sends. outreach_campaign_
 * sends doubles as both the immutable send-attempt ledger and the job
 * record — see the schema.ts comment on that table. If a dedicated queue is
 * introduced later, these fields (status/claimed_at/claimed_by/
 * lease_expires_at/attempt_count) are the same shape a real queue message
 * would carry, so the domain model would not need to be rewritten.
 */

export const DEFAULT_LEASE_DURATION_MS = 5 * 60_000; // 5 minutes
export const DEFAULT_CLAIM_BATCH_SIZE = 25;

/**
 * Atomically claims one due send. The WHERE clause is re-evaluated by the
 * database at UPDATE time against the row's CURRENT state, not a snapshot
 * taken earlier — so if another worker already claimed this row between our
 * candidate scan and this call, rowsAffected is 0 and we correctly lose the
 * race. This is what keeps concurrent workers (overlapping cron
 * invocations, a manual backfill run alongside cron) from ever both
 * processing the same send.
 */
async function tryClaimSend(
  sendId: string,
  workerId: string,
  leaseDurationMs: number,
): Promise<boolean> {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

  const result = await db
    .update(outreachCampaignSends)
    .set({
      status: "claimed",
      claimedAt: now,
      claimedBy: workerId,
      leaseExpiresAt,
      updatedAt: now,
    })
    .where(
      and(
        eq(outreachCampaignSends.id, sendId),
        or(
          eq(outreachCampaignSends.status, "scheduled"),
          and(
            eq(outreachCampaignSends.status, "claimed"),
            lt(outreachCampaignSends.leaseExpiresAt, now),
          ),
        ),
      ),
    );

  return (result.rowsAffected ?? 0) > 0;
}

/**
 * Scans for due sends (scheduled and due, or claimed with an expired lease
 * — a crashed/timed-out worker's abandoned claim) and attempts to claim up
 * to batchSize of them one at a time. Returns only the ids this call
 * actually won. Bounded by batchSize so a single Vercel Cron invocation has
 * predictable, bounded execution time; the next tick picks up whatever is
 * still due.
 */
export async function claimDueSends(
  workerId: string,
  batchSize: number = DEFAULT_CLAIM_BATCH_SIZE,
  leaseDurationMs: number = DEFAULT_LEASE_DURATION_MS,
): Promise<string[]> {
  const now = new Date();

  const candidates = await db
    .select({ id: outreachCampaignSends.id })
    .from(outreachCampaignSends)
    .where(
      or(
        and(
          eq(outreachCampaignSends.status, "scheduled"),
          lte(outreachCampaignSends.scheduledAt, now),
        ),
        and(
          eq(outreachCampaignSends.status, "claimed"),
          lt(outreachCampaignSends.leaseExpiresAt, now),
        ),
      ),
    )
    .orderBy(asc(outreachCampaignSends.scheduledAt))
    .limit(batchSize);

  const claimed: string[] = [];
  for (const candidate of candidates) {
    const won = await tryClaimSend(candidate.id, workerId, leaseDurationMs);
    if (won) claimed.push(candidate.id);
  }
  return claimed;
}

/**
 * Failures the send worker may itself retry (transient, provider- or
 * network-side). Never includes anything that would still fail identically
 * on a retry.
 */
export const RETRYABLE_FAILURE_CODES = [
  "rate_limited",
  "provider_timeout",
  "provider_unavailable",
  "network_error",
  "provider_5xx",
] as const;

/**
 * Failures that will never succeed on retry — retrying wastes attempts and,
 * for "suppressed"/"missing_consent", would violate the policy that's
 * blocking the send in the first place.
 */
export const PERMANENT_FAILURE_CODES = [
  "invalid_recipient",
  "suppressed",
  "missing_consent",
  "invalid_template",
  "provider_rejected_permanent",
] as const;

export type RetryableFailureCode = (typeof RETRYABLE_FAILURE_CODES)[number];
export type PermanentFailureCode = (typeof PERMANENT_FAILURE_CODES)[number];
export type FailureCode = RetryableFailureCode | PermanentFailureCode;

export function isRetryableFailureCode(code: string): code is RetryableFailureCode {
  return (RETRYABLE_FAILURE_CODES as readonly string[]).includes(code);
}

export const MAX_SEND_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000; // 1 minute
const MAX_BACKOFF_MS = 60 * 60_000; // 1 hour cap

/**
 * Capped exponential backoff: 1m, 2m, 4m, 8m, 16m, ... capped at 1h.
 * attemptCount is the count AFTER the attempt that just failed (i.e. the
 * first retry is computed with attemptCount = 1).
 */
export function computeBackoffMs(attemptCount: number): number {
  const exponential = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attemptCount - 1));
  return Math.min(exponential, MAX_BACKOFF_MS);
}

async function getSendOrThrow(sendId: string) {
  const rows = await db
    .select()
    .from(outreachCampaignSends)
    .where(eq(outreachCampaignSends.id, sendId))
    .limit(1);
  const send = rows[0];
  if (!send) throw new Error("Send record not found.");
  return send;
}

/**
 * Records a successful delivery attempt. Terminal — a "sent" row is never
 * retried. renderedSubject/renderedBody/personalizationMetadata are stored
 * here (not just the final content) so a later audit can distinguish
 * template vs. personalization vs. what was actually transmitted.
 */
export async function recordSendSuccess(
  sendId: string,
  params: {
    externalMessageId?: string | null;
    renderedSubject?: string | null;
    renderedBody?: string | null;
    personalizationMetadata?: string | null;
  },
): Promise<void> {
  const current = await getSendOrThrow(sendId);
  const now = new Date();

  await db
    .update(outreachCampaignSends)
    .set({
      status: "sent",
      attemptCount: current.attemptCount + 1,
      lastAttemptAt: now,
      completedAt: now,
      externalMessageId: params.externalMessageId ?? null,
      renderedSubject: params.renderedSubject ?? null,
      renderedBody: params.renderedBody ?? null,
      personalizationMetadata: params.personalizationMetadata ?? null,
      failureCode: null,
      failureReason: null,
      updatedAt: now,
    })
    .where(eq(outreachCampaignSends.id, sendId));
}

export type RecordSendFailureResult = "retry_scheduled" | "dead_letter" | "failed";

/**
 * Records a failed delivery attempt and decides, deterministically, what
 * happens next:
 *  - a retryable code under MAX_SEND_ATTEMPTS is rescheduled with backoff
 *    (status returns to "scheduled", claim fields cleared so any worker can
 *    pick it up again once next_attempt_at is due);
 *  - a retryable code that has exhausted MAX_SEND_ATTEMPTS becomes
 *    "dead_letter" (needs human attention, distinct from a genuinely
 *    permanent failure);
 *  - a permanent code becomes "failed" immediately, regardless of attempt
 *    count.
 * failureReason must be a short, non-sensitive string — never a stack trace
 * or the full provider payload.
 */
export async function recordSendFailure(
  sendId: string,
  code: FailureCode,
  failureReason: string,
): Promise<RecordSendFailureResult> {
  const current = await getSendOrThrow(sendId);
  const attemptCount = current.attemptCount + 1;
  const now = new Date();
  const retryable = isRetryableFailureCode(code);

  if (retryable && attemptCount < MAX_SEND_ATTEMPTS) {
    const nextAttemptAt = new Date(now.getTime() + computeBackoffMs(attemptCount));
    await db
      .update(outreachCampaignSends)
      .set({
        status: "scheduled",
        scheduledAt: nextAttemptAt,
        attemptCount,
        lastAttemptAt: now,
        nextAttemptAt,
        claimedAt: null,
        claimedBy: null,
        leaseExpiresAt: null,
        failureCode: code,
        failureReason,
        updatedAt: now,
      })
      .where(eq(outreachCampaignSends.id, sendId));
    return "retry_scheduled";
  }

  const terminalStatus = retryable ? "dead_letter" : "failed";
  await db
    .update(outreachCampaignSends)
    .set({
      status: terminalStatus,
      attemptCount,
      lastAttemptAt: now,
      completedAt: now,
      failureCode: code,
      failureReason,
      updatedAt: now,
    })
    .where(eq(outreachCampaignSends.id, sendId));
  return terminalStatus;
}
