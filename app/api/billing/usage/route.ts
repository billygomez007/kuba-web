import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessPlan } from "@/lib/billing/entitlements";
import { getBusinessUsage } from "@/lib/billing/usage";
import { activeBillingProvider, getBillingProvider } from "@/lib/billing/provider";
import { subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getCurrentMembership();
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.BILLING_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const plan = await getBusinessPlan(membership.businessId);
    const subscription = (await db.select({ provider: subscriptions.provider, status: subscriptions.status, currentPeriodStart: subscriptions.currentPeriodStart, currentPeriodEnd: subscriptions.currentPeriodEnd, cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd, trialEnd: subscriptions.trialEnd, paymentMethodSummary: subscriptions.paymentMethodSummary }).from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0] || null;
    const provider = getBillingProvider();
    return NextResponse.json({ plan, provider: activeBillingProvider(), capabilities: provider.capabilities, subscription, usage: await getBusinessUsage(membership.businessId, plan) });
  } catch (error) {
    console.error("Load billing usage error:", error);
    return NextResponse.json({ error: "Unable to load billing." }, { status: 500 });
  }
}
