import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getBusinessMembership } from "@/lib/auth/permissions";
import { normalizePlan } from "@/lib/billing/entitlements";
import { getConfiguredPriceId, paystackProvider, TRIAL_DAYS } from "@/lib/billing/provider";
import { createAuditLog } from "@/lib/auth/audit";

/**
 * Redirect target Paystack sends the customer back to after card
 * authorization. Completes steps 2 (verify) and 3 (create the deferred
 * subscription) of the authorize -> verify -> subscribe lifecycle.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") || url.searchParams.get("trxref");
  const origin = url.origin;
  const fail = (planForRetry: string, reason: string) => NextResponse.redirect(`${origin}/onboarding?resume=plan&plan=${planForRetry}&trialError=${encodeURIComponent(reason)}`);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.redirect(`${origin}/login`);

  const membership = await getBusinessMembership(session.user.id);
  const fallbackPlan = url.searchParams.get("plan") || "growth";
  if (!membership) return fail(fallbackPlan, "Business access denied.");
  if (!reference) return fail(fallbackPlan, "Missing verification reference.");

  try {
    const authorization = await paystackProvider.verifyPaymentMethod!(reference);

    // Best-effort refund of the verification charge — never blocks trial
    // activation. If it fails, the customer sees the honest disclosure that
    // refund timing depends on their bank; the amount is small and disclosed
    // up front.
    const refund = await paystackProvider.refundVerificationCharge!(reference).catch(() => ({ refunded: false }));

    const plan = normalizePlan(fallbackPlan);
    const planCode = getConfiguredPriceId(plan);
    if (!planCode) return fail(plan, "This plan is not configured for trial checkout yet.");

    // Idempotency safety net: re-check immediately before writing, in case the
    // customer completed authorization twice (e.g. two tabs).
    const existing = (await db.select({ id: subscriptions.id }).from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0];
    if (existing) return NextResponse.redirect(`${origin}/dashboard?trial=already_active`);

    const now = new Date();
    const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const subscription = await paystackProvider.createTrialSubscription!({ customerCode: authorization.customerCode, authorizationCode: authorization.authorizationCode, planCode, startDate: trialEnd });

    const paymentMethodSummary = authorization.cardBrand && authorization.last4 ? `${authorization.cardBrand} •••• ${authorization.last4}` : null;

    await db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      businessId: membership.businessId,
      provider: "paystack",
      providerCustomerId: authorization.customerCode,
      providerSubscriptionId: subscription.subscriptionCode,
      providerAuthorizationReference: authorization.authorizationCode,
      providerEventId: `trial:${reference}`,
      paymentMethodSummary,
      plan,
      status: "trialing",
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      cancelAtPeriodEnd: false,
      trialEnd,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog({
      businessId: membership.businessId, userId: session.user.id, action: "billing.trial.started", resource: "business_plan",
      metadata: { provider: "paystack", plan, trialDays: TRIAL_DAYS, trialEnd: trialEnd.toISOString(), subscriptionCode: subscription.subscriptionCode, verificationAmount: authorization.verificationAmount, verificationCurrency: authorization.verificationCurrency, verificationRefunded: refund.refunded },
    });

    return NextResponse.redirect(`${origin}/dashboard?trial=started`);
  } catch (error) {
    console.error("Paystack trial callback error:", error);
    return fail(fallbackPlan, error instanceof Error ? error.message : "Unable to complete your free trial setup.");
  }
}
