import { NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";

import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { paystackVerificationAmount } from "@/lib/billing/provider";

/**
 * Safety-net trial finalization. Paystack's own `start_date` mechanism is the
 * PRIMARY transition trigger (Paystack itself attempts the first charge on
 * that date and notifies us via webhook — see app/api/billing/webhooks/
 * paystack/route.ts), so this is deliberately not the main mechanism, only a
 * fallback for the case a webhook delivery was missed. Runs on Vercel Cron
 * (see vercel.json); protected by CRON_SECRET so it cannot be triggered by
 * an arbitrary request.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = process.env.PAYSTACK_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ status: "skipped", reason: "PAYSTACK_SECRET_KEY not configured" });
  }

  const now = new Date();
  const overdue = await db
    .select({ id: subscriptions.id, businessId: subscriptions.businessId, providerSubscriptionId: subscriptions.providerSubscriptionId })
    .from(subscriptions)
    .where(and(eq(subscriptions.provider, "paystack"), eq(subscriptions.status, "trialing"), lt(subscriptions.trialEnd, now)));

  const results: Array<{ businessId: string; outcome: string }> = [];

  for (const row of overdue) {
    if (!row.providerSubscriptionId) {
      results.push({ businessId: row.businessId, outcome: "skipped: no provider subscription id" });
      continue;
    }
    try {
      const response = await fetch(`https://api.paystack.co/subscription/${encodeURIComponent(row.providerSubscriptionId)}`, { headers: { Authorization: `Bearer ${secretKey}` } });
      const data = await response.json();
      const remoteStatus = String(data?.data?.status || "").toLowerCase();
      let nextStatus: "active" | "past_due" | "canceled" | null = null;
      if (remoteStatus === "active") nextStatus = "active";
      else if (remoteStatus === "attention") nextStatus = "past_due";
      else if (remoteStatus === "complete" || remoteStatus === "non-renewing" || remoteStatus === "cancelled") nextStatus = "canceled";

      if (nextStatus) {
        await db.update(subscriptions).set({ status: nextStatus, updatedAt: new Date() }).where(eq(subscriptions.id, row.id));
        results.push({ businessId: row.businessId, outcome: `reconciled -> ${nextStatus}` });
      } else {
        results.push({ businessId: row.businessId, outcome: `no change (remote status: ${remoteStatus || "unknown"})` });
      }
    } catch (error) {
      console.error("Trial reconciliation error for business", row.businessId, error);
      results.push({ businessId: row.businessId, outcome: "error" });
    }
  }

  return NextResponse.json({ status: "ok", checked: overdue.length, results, verificationCurrencyConfigured: paystackVerificationAmount(process.env.SUPERKUBA_BILLING_CURRENCY || "GHS") != null });
}
