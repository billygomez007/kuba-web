import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getConfiguredPriceId, getBillingProvider, activeBillingProvider } from "@/lib/billing/provider";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { createAuditLog } from "@/lib/auth/audit";
import { getBusinessPlan, normalizePlan, planOrder } from "@/lib/billing/entitlements";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getBusinessMembership(session.user.id);
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.BILLING_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const body = await request.json();
    const plan = normalizePlan(typeof body.plan === "string" ? body.plan : "");
    if (plan === "starter" || body.plan !== plan) return NextResponse.json({ error: "Choose a paid Growth or Pro plan." }, { status: 400 });
    if (plan === "enterprise") return NextResponse.json({ error: "Enterprise plans require a sales conversation.", contactSales: true }, { status: 400 });
    const currentPlan = await getBusinessPlan(membership.businessId);
    if (planOrder.indexOf(plan) <= planOrder.indexOf(currentPlan.id)) {
      return NextResponse.json({ error: "Checkout is available only for an upgrade. Manage downgrades through the provider or contact support.", code: "PLAN_CHANGE_NOT_SUPPORTED" }, { status: 409 });
    }
    const priceId = getConfiguredPriceId(plan);
    if (!priceId) return NextResponse.json({ error: "This plan is not configured for checkout yet." }, { status: 503 });
    const current = (await db.select({ customerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0];
    const origin = new URL(request.url).origin;
    const provider = activeBillingProvider();
    const successUrl = provider === "paystack" ? `${origin}/api/billing/callback/paystack?plan=${plan}` : `${origin}/dashboard/billing?checkout=success`;
    const checkout = await getBillingProvider().createCheckoutSession({ customerId: current?.customerId, priceId, successUrl, cancelUrl: `${origin}/dashboard/billing/plans?checkout=cancelled`, metadata: { businessId: membership.businessId, plan, email: session.user.email } });
    await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.checkout.started", resource: "business_plan", metadata: { provider, plan, checkoutSessionId: checkout.id } });
    return NextResponse.json({ url: checkout.url });
  } catch (error) { console.error("Billing checkout error:", error); return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 }); }
}
