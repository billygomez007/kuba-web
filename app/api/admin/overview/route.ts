import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployees, businesses, subscriptions, users } from "@/db/schema";
import { authorizationErrorResponse, requireSuperAdmin } from "@/lib/auth/authorization";

export async function GET() {
  try {
    await requireSuperAdmin();

    const [businessCount, userCount, employeeCount, activeSubscriptionCount] = await Promise.all([
      db.select({ value: count() }).from(businesses),
      db.select({ value: count() }).from(users).where(eq(users.status, "active")),
      db.select({ value: count() }).from(aiEmployees).where(eq(aiEmployees.status, "active")),
      db.select({ value: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
    ]);

    return NextResponse.json({
      businesses: businessCount[0]?.value ?? 0,
      activeUsers: userCount[0]?.value ?? 0,
      activeAiEmployees: employeeCount[0]?.value ?? 0,
      activeSubscriptions: activeSubscriptionCount[0]?.value ?? 0,
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    console.error("Admin overview error:", error);
    return NextResponse.json({ error: "Unable to load platform overview." }, { status: 500 });
  }
}
