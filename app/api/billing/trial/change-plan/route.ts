import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { normalizePlan } from "@/lib/billing/entitlements";
import { getBillingProvider, getConfiguredPriceId, activeBillingProvider } from "@/lib/billing/provider";
import { createAuditLog } from "@/lib/auth/audit";

const SELF_SERVE_TRIAL_PLANS = ["starter", "growth", "pro"] as const;

/**
 * Changes the INTENDED post-trial plan while a trial is still active. The
 * original trial end date is never moved. Paystack has no single-subscription
 * "change plan" endpoint (its Update Plan API mutates the plan object for
 * every subscriber, not one customer) — the correct Paystack-native approach
 * is to disable the still-pending (not yet started/charged) subscription and
 * schedule a new one for the new plan at the SAME start_date, so there is no
 * surprise immediate charge and no reset trial clock.
 */
export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await getBusinessMembership(session.user.id);
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.BILLING_MANAGE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const requestedPlan = typeof body.plan === "string" ? body.plan : "";
    const plan = normalizePlan(requestedPlan);
    if (requestedPlan !== plan || !(SELF_SERVE_TRIAL_PLANS as readonly string[]).includes(plan)) {
      return NextResponse.json({ error: "Choose Starter, Growth, or Pro." }, { status: 400 });
    }

    const current = (await db.select().from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0];
    if (!current || current.status !== "trialing") {
      return NextResponse.json({ error: "Plan changes during the trial are only available while your trial is active." }, { status: 409 });
    }
    if (current.plan === plan) {
      return NextResponse.json({ success: true, plan, trialEnd: current.trialEnd });
    }
    if (!current.trialEnd) {
      return NextResponse.json({ error: "Your trial end date could not be determined." }, { status: 500 });
    }

    const provider = getBillingProvider();
    if (activeBillingProvider() !== "paystack" || !provider.createTrialSubscription) {
      return NextResponse.json({ error: "Plan changes during trial are not available for the current billing provider." }, { status: 503 });
    }

    const newPlanCode = getConfiguredPriceId(plan);
    if (!newPlanCode) return NextResponse.json({ error: "This plan is not configured yet.", code: "CONFIGURATION_REQUIRED" }, { status: 503 });
    if (!current.providerCustomerId || !current.providerAuthorizationReference) {
      return NextResponse.json({ error: "No saved payment authorization was found for this business." }, { status: 409 });
    }

    // Disable the still-pending subscription first — it has not started or
    // charged anything yet (start_date is still in the future).
    if (current.providerSubscriptionId && provider.cancelSubscription) {
      try {
        await provider.cancelSubscription(current.providerSubscriptionId, current.providerCustomerId);
      } catch (error) {
        console.error("Unable to disable the previous pending Paystack subscription during a plan change:", error);
      }
    }

    const scheduled = await provider.createTrialSubscription({ customerCode: current.providerCustomerId, authorizationCode: current.providerAuthorizationReference, planCode: newPlanCode, startDate: current.trialEnd });

    await db.update(subscriptions).set({ plan, providerSubscriptionId: scheduled.subscriptionCode, updatedAt: new Date() }).where(eq(subscriptions.businessId, membership.businessId));

    await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.trial.plan_changed", resource: "business_plan", metadata: { fromPlan: current.plan, toPlan: plan, trialEnd: current.trialEnd.toISOString() } });

    return NextResponse.json({ success: true, plan, trialEnd: current.trialEnd });
  } catch (error) {
    console.error("Trial plan change error:", error);
    return NextResponse.json({ error: "Unable to change your plan." }, { status: 500 });
  }
}
