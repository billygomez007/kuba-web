import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { outreachCampaignRecipients } from "@/db/schema";
import { addSuppression } from "@/lib/outreach/suppression";
import { verifyUnsubscribeToken } from "@/lib/outreach/unsubscribe-token";
import { assertRecipientTransition, type RecipientStatus } from "@/lib/outreach/recipient-state";

/**
 * Unsubscribe link target for campaign emails (section 28). Deliberately
 * unauthenticated — a prospect who never created a SuperKuba account must
 * still be able to opt out — and authorized solely by the signed token,
 * never a raw database id. Idempotent: visiting the same link twice (a
 * mail client prefetching links, a user clicking twice) is a safe no-op.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Missing unsubscribe token." }, { status: 400 });
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    return NextResponse.json({ error: "This unsubscribe link is invalid." }, { status: 400 });
  }

  await addSuppression({
    businessId: payload.businessId,
    channel: payload.channel,
    identity: payload.identity,
    reason: "unsubscribed",
  });

  // Best-effort recipient-state transition — the suppression row above is
  // what actually stops future sends, so this is not load-bearing for
  // correctness, only for the recipient/campaign dashboard reflecting the
  // opt-out accurately.
  const recipientRows = await db
    .select({ id: outreachCampaignRecipients.id, status: outreachCampaignRecipients.status })
    .from(outreachCampaignRecipients)
    .where(eq(outreachCampaignRecipients.id, payload.recipientId))
    .limit(1);
  const recipient = recipientRows[0];

  if (recipient && recipient.status !== "opted_out") {
    try {
      assertRecipientTransition(recipient.status as RecipientStatus, "opted_out");
      await db
        .update(outreachCampaignRecipients)
        .set({ status: "opted_out", optedOutAt: new Date(), updatedAt: new Date() })
        .where(eq(outreachCampaignRecipients.id, recipient.id));
    } catch {
      // Already in a terminal state (completed/handed_off/etc.) — the
      // suppression row still prevents any future send, so this is fine.
    }
  }

  return new Response(
    "<!doctype html><html><body style=\"font-family:sans-serif;padding:2rem;\"><h1>You're unsubscribed</h1><p>You will not receive further emails from this campaign.</p></body></html>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
