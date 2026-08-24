import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { businesses, subscriptions } from "@/db/schema";
import { stripeProvider } from "@/lib/billing/provider";
import { saveSubscription } from "@/lib/billing/subscription-service";
import { createAuditLog } from "@/lib/auth/audit";
import { verifyStripeWebhookSignature } from "@/lib/billing/stripe-signature";

export async function POST(request: Request) {
  const payload = await request.text();
  if (!verifyStripeWebhookSignature(payload, request.headers.get("stripe-signature"))) return NextResponse.json({ error: "Invalid or expired webhook signature." }, { status: 400 });
  const subscription = stripeProvider.parseWebhook(payload, request.headers.get("stripe-signature"));
  if (!subscription) return NextResponse.json({ error: "Invalid webhook signature or unsupported event." }, { status: 400 });
  try {
    const eventObject = JSON.parse(payload) as { data?: { object?: { metadata?: { businessId?: string } } } };
    const metadataBusinessId = eventObject.data?.object?.metadata?.businessId;
    const business = metadataBusinessId ? (await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, metadataBusinessId)).limit(1))[0] : subscription.providerCustomerId ? (await db.select({ id: businesses.id }).from(businesses).innerJoin(subscriptions, eq(subscriptions.businessId, businesses.id)).where(and(eq(subscriptions.providerCustomerId, subscription.providerCustomerId), eq(subscriptions.provider, "stripe"))).limit(1))[0] : null;
    if (!business) return NextResponse.json({ error: "Subscription business could not be resolved." }, { status: 400 });
    const changed = await saveSubscription(business.id, subscription, "stripe");
    if (changed) await createAuditLog({ businessId: business.id, action: "billing.subscription.updated", resource: "business_subscription", resourceId: subscription.providerSubscriptionId, description: "Subscription state updated from Stripe webhook.", metadata: { providerEventId: subscription.providerEventId, status: subscription.status, plan: subscription.plan } });
    return NextResponse.json({ received: true, duplicate: !changed });
  } catch (error) { console.error("Stripe webhook processing error:", error); return NextResponse.json({ error: "Unable to process webhook." }, { status: 500 }); }
}
