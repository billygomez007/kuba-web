import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";
import { authorizationErrorResponse, requireBusinessContext } from "@/lib/auth/authorization";

export async function GET(request: Request) {
  try {
    const context = await requireBusinessContext(request);
    const subscription = (await db.select({
      id: subscriptions.id,
      status: subscriptions.status,
      billingInterval: subscriptions.billingInterval,
      startedAt: subscriptions.startedAt,
      currentPeriodEndsAt: subscriptions.currentPeriodEndsAt,
      cancelledAt: subscriptions.cancelledAt,
      planCode: plans.code,
      planName: plans.name,
    }).from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.businessId, context.business.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1))[0] ?? null;

    return NextResponse.json({ subscription });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Billing subscription error:", error);
    return NextResponse.json({ error: "Unable to load subscription." }, { status: 500 });
  }
}
