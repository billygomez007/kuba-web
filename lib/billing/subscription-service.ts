import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import type { BillingSubscription } from "./provider";

export async function saveSubscription(businessId: string, subscription: BillingSubscription, provider: "stripe" | "paystack" = subscription.provider || "stripe") {
  const existing = (await db.select({ id: subscriptions.id, providerEventId: subscriptions.providerEventId }).from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1))[0];
  if (existing?.providerEventId === subscription.providerEventId) return false;
  const values = { provider, providerCustomerId: subscription.providerCustomerId, providerSubscriptionId: subscription.providerSubscriptionId, providerEventId: subscription.providerEventId, plan: subscription.plan, status: subscription.status, currentPeriodStart: subscription.currentPeriodStart, currentPeriodEnd: subscription.currentPeriodEnd, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd, trialEnd: subscription.trialEnd, updatedAt: new Date() };
  if (existing) await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
  else await db.insert(subscriptions).values({ id: crypto.randomUUID(), businessId, ...values, createdAt: new Date() });
  return true;
}
