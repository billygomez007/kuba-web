import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { activeBillingProvider, getBillingProvider } from "@/lib/billing/provider";
import { createAuditLog } from "@/lib/auth/audit";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await getBusinessMembership(session.user.id);
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.BILLING_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const subscription = (await db.select({ id: subscriptions.id, providerSubscriptionId: subscriptions.providerSubscriptionId, providerCustomerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0];
  const provider = getBillingProvider();
  if (!subscription?.providerSubscriptionId || !provider.capabilities.supportsCancellation || !provider.cancelSubscription) return NextResponse.json({ error: "Cancellation is not supported by the current billing provider." }, { status: 409 });
  const result = await provider.cancelSubscription(subscription.providerSubscriptionId, subscription.providerCustomerId);
  if (!result.confirmed) return NextResponse.json({ error: "Provider did not confirm cancellation." }, { status: 502 });
  await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.subscription.cancellation_requested", resource: "business_subscription", resourceId: subscription.id, metadata: { provider: activeBillingProvider() } });
  return NextResponse.json({ success: true, status: "pending_provider_confirmation" });
}
