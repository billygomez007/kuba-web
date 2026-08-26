import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { normalizePlan } from "@/lib/billing/entitlements";
import { activeBillingProvider, getBillingProvider, getConfiguredPriceId } from "@/lib/billing/provider";
import { createAuditLog } from "@/lib/auth/audit";

const TRIAL_DAYS = 14;
const SELF_SERVE_TRIAL_PLANS = ["starter", "growth", "pro"] as const;

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
    // normalizePlan silently coerces anything unrecognized to "starter" — that
    // coercion is fine for display defaults, but a trial request must reject
    // an unrecognized/tampered value outright rather than quietly downgrade it.
    if (requestedPlan !== plan || !(SELF_SERVE_TRIAL_PLANS as readonly string[]).includes(plan)) {
      return NextResponse.json({ error: "Choose Starter, Growth, or Pro to start a free trial. Enterprise is sales-led.", contactSales: requestedPlan === "enterprise" }, { status: 400 });
    }

    // One introductory trial per business: once any subscription row exists
    // (trialing, active, cancelled, or otherwise), self-serve trial
    // activation is no longer available — further plan changes go through
    // the existing upgrade/portal flows instead. This does not rely on
    // cookies/localStorage and cannot be reset by the client.
    const existing = (await db.select({ id: subscriptions.id, status: subscriptions.status }).from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0];
    if (existing) {
      return NextResponse.json({ error: "This business has already used its introductory trial.", code: "TRIAL_ALREADY_USED" }, { status: 409 });
    }

    const provider = activeBillingProvider();
    if (provider !== "stripe") {
      return NextResponse.json({ error: "Self-service free trials are not available for the currently configured billing provider.", code: "TRIAL_NOT_SUPPORTED_FOR_PROVIDER" }, { status: 503 });
    }

    const priceId = getConfiguredPriceId(plan);
    if (!priceId) {
      return NextResponse.json({ error: "This plan is not configured for trial checkout yet.", code: "CONFIGURATION_REQUIRED" }, { status: 503 });
    }

    const origin = new URL(request.url).origin;
    const successUrl = `${origin}/dashboard?trial=started`;
    const cancelUrl = `${origin}/onboarding?resume=plan&plan=${plan}`;

    // Idempotency: a rapid double-click of "Start Free Trial" resolves to the
    // SAME Stripe Checkout Session (Stripe deduplicates by this key) instead
    // of creating two. Scoped to the business+plan, not a random value, so
    // retries of the identical request are the ones deduplicated.
    const idempotencyKey = `trial:${membership.businessId}:${plan}`;

    const checkout = await getBillingProvider().createCheckoutSession({
      priceId,
      successUrl,
      cancelUrl,
      metadata: { businessId: membership.businessId, plan, email: session.user.email },
      trialPeriodDays: TRIAL_DAYS,
      idempotencyKey,
    });

    await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.trial.started", resource: "business_plan", metadata: { provider, plan, trialDays: TRIAL_DAYS, checkoutSessionId: checkout.id } });

    return NextResponse.json({ url: checkout.url, trialDays: TRIAL_DAYS });
  } catch (error) {
    console.error("Billing trial start error:", error);
    return NextResponse.json({ error: "Unable to start your free trial." }, { status: 500 });
  }
}
