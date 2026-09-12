import { NextResponse } from "next/server";
import crypto from "crypto";

import { startDueCampaigns } from "@/lib/outreach/campaign-lifecycle";
import { processClaimedSend } from "@/lib/outreach/process-send";
import { claimDueSends, DEFAULT_CLAIM_BATCH_SIZE } from "@/lib/outreach/send-worker";

/**
 * Vercel Cron endpoint for the Outreach Campaign Engine's durable send
 * queue. Mirrors the existing cron protection convention (see
 * app/api/billing/cron/reconcile-trials/route.ts) rather than inventing a
 * weaker one: CRON_SECRET, Bearer-compared, so this can never be triggered
 * by an arbitrary request.
 *
 * Bounded and non-looping by design: claims a fixed-size batch and returns.
 * The next cron tick (see vercel.json) handles whatever is still due —
 * there is no polling loop inside this request. Safe under concurrent or
 * duplicate invocation: claiming is an atomic compare-and-swap per send row
 * (see send-worker.ts), so two overlapping invocations can never both
 * process the same send.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const runId = crypto.randomUUID();
  const workerId = `cron-${runId}`;

  const startedCampaigns = await startDueCampaigns();

  const claimedSendIds = await claimDueSends(workerId, DEFAULT_CLAIM_BATCH_SIZE);

  const results: Array<{ sendId: string; outcome: string }> = [];
  for (const sendId of claimedSendIds) {
    try {
      const result = await processClaimedSend(sendId);
      results.push({ sendId, outcome: result.outcome });
    } catch (error) {
      // One send's unexpected failure must never abort the rest of the
      // batch (section 31: "process each safely").
      console.error("Outreach campaign send processing error", { runId, sendId, error });
      results.push({ sendId, outcome: "error" });
    }
  }

  console.log("Outreach campaign cron run", {
    runId,
    workerId,
    startedCampaigns,
    claimed: claimedSendIds.length,
    outcomes: results.reduce<Record<string, number>>((counts, item) => {
      counts[item.outcome] = (counts[item.outcome] || 0) + 1;
      return counts;
    }, {}),
  });

  return NextResponse.json({
    status: "ok",
    runId,
    startedCampaigns,
    claimed: claimedSendIds.length,
    results,
  });
}
