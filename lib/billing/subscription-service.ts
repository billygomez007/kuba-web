import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import type { BillingSubscription } from "./provider";

export async function saveSubscription(businessId: string, subscription: BillingSubscription, provider: "stripe" | "paystack" = subscription.provider || "stripe") {
  const existing = (await db.select({ id: subscriptions.id, providerEventId: subscriptions.providerEventId, currentPeriodStart: subscriptions.currentPeriodStart, currentPeriodEnd: subscriptions.currentPeriodEnd, trialEnd: subscriptions.trialEnd }).from(subscriptions).where(eq(subscriptions.businessId, businessId)).limit(1))[0];
  if (existing?.providerEventId === subscription.providerEventId) return false;
  // A webhook event that doesn't carry period/trial-end data (e.g. Paystack's
  // subscription.disable on cancellation) must never null out an already-known
  // date — a customer who cancels is promised access until that date remains
  // usable (see app/dashboard/billing/page.tsx's disclosure copy), and
  // entitlements.ts requires currentPeriodEnd to still be in the future for a
  // "canceled"/"past_due" row to stay usable. Only overwrite when the event
  // actually supplies a new value.
  const values = {
    provider,
    providerCustomerId: subscription.providerCustomerId,
    providerSubscriptionId: subscription.providerSubscriptionId,
    providerEventId: subscription.providerEventId,
    plan: subscription.plan,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart ?? existing?.currentPeriodStart ?? null,
    currentPeriodEnd: subscription.currentPeriodEnd ?? existing?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    trialEnd: subscription.trialEnd ?? existing?.trialEnd ?? null,
    updatedAt: new Date(),
  };
  if (existing) await db.update(subscriptions).set(values).where(eq(subscriptions.id, existing.id));
  else await db.insert(subscriptions).values({ id: crypto.randomUUID(), businessId, ...values, createdAt: new Date() });
  return true;
}
