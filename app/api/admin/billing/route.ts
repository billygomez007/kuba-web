import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { businesses, plans, subscriptions } from "@/db/schema";
import { authorizationErrorResponse, requireSuperAdmin } from "@/lib/auth/authorization";

export async function GET() {
  try {
    await requireSuperAdmin();

    const [planCatalog, subscriptionRows] = await Promise.all([
      db.select().from(plans),
      db.select({
        id: subscriptions.id,
        businessId: subscriptions.businessId,
        businessName: businesses.name,
        status: subscriptions.status,
        billingInterval: subscriptions.billingInterval,
        startedAt: subscriptions.startedAt,
        currentPeriodEndsAt: subscriptions.currentPeriodEndsAt,
        planCode: plans.code,
        planName: plans.name,
      }).from(subscriptions)
        .innerJoin(businesses, eq(subscriptions.businessId, businesses.id))
        .innerJoin(plans, eq(subscriptions.planId, plans.id)),
    ]);

    return NextResponse.json({ plans: planCatalog, subscriptions: subscriptionRows });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Admin billing error:", error);
    return NextResponse.json({ error: "Unable to load billing data." }, { status: 500 });
  }
}
