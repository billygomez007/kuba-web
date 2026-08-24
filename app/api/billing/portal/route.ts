import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getBusinessMembership, hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBillingProvider, activeBillingProvider } from "@/lib/billing/provider";
import { createAuditLog } from "@/lib/auth/audit";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getBusinessMembership(session.user.id);
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const subscription = (await db.select({ customerId: subscriptions.providerCustomerId }).from(subscriptions).where(eq(subscriptions.businessId, membership.businessId)).limit(1))[0];
    if (!subscription?.customerId) return NextResponse.json({ error: "Billing provider not connected." }, { status: 409 });
    const provider = activeBillingProvider();
    const portal = await getBillingProvider().createPortalSession(subscription.customerId, `${new URL(request.url).origin}/dashboard/billing`);
    await createAuditLog({ businessId: membership.businessId, userId: session.user.id, action: "billing.portal.opened", resource: "business_subscription", metadata: { provider } });
    return NextResponse.json({ url: portal.url });
  } catch (error) { console.error("Billing portal error:", error); return NextResponse.json({ error: "Unable to open billing portal." }, { status: 500 }); }
}
