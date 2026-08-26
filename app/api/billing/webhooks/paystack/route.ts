import { NextResponse } from "next/server";
import { db } from "@/db";
import { businesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { paystackProvider, verifyPaystackSignature } from "@/lib/billing/provider";
import { saveSubscription } from "@/lib/billing/subscription-service";

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid Paystack signature." }, { status: 400 });
  }

  const subscription = paystackProvider.parseWebhook(payload, signature);
  if (!subscription) {
    // Signature is valid but this event is intentionally not actionable
    // (verification charge, or a purely informational event) — acknowledge
    // so Paystack does not retry-storm an event we deliberately ignore.
    return NextResponse.json({ received: true, ignored: true });
  }

  const body = JSON.parse(payload) as { data?: { metadata?: { businessId?: string } } };
  const businessId = body.data?.metadata?.businessId;
  if (!businessId || !(await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1))[0]) {
    return NextResponse.json({ error: "Business could not be resolved." }, { status: 400 });
  }

  return NextResponse.json({ received: true, duplicate: !(await saveSubscription(businessId, subscription, "paystack")) });
}
