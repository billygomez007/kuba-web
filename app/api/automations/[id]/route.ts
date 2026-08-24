import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { automationRuns, automations, businessUsers } from "@/db/schema";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const membership = await db
      .select({ businessId: businessUsers.businessId })
      .from(businessUsers)
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);
    const business = membership[0];
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const { id } = await context.params;
    const automationResult = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, id), eq(automations.businessId, business.businessId)))
      .limit(1);
    const automation = automationResult[0];
    if (!automation) return NextResponse.json({ error: "Automation not found." }, { status: 404 });

    const runs = await db
      .select()
      .from(automationRuns)
      .where(and(eq(automationRuns.automationId, id), eq(automationRuns.businessId, business.businessId)))
      .orderBy(desc(automationRuns.startedAt))
      .limit(100);
    const completedRuns = runs.filter((run) => run.status === "completed").length;
    const successRate = runs.length ? Math.round((completedRuns / runs.length) * 100) : null;

    return NextResponse.json({
      automation: {
        ...automation,
        conditions: automation.conditions ? JSON.parse(automation.conditions) : [],
        actions: JSON.parse(automation.actions),
      },
      runs,
      performance: {
        totalRuns: runs.length,
        completedRuns,
        failedRuns: runs.filter((run) => run.status === "failed").length,
        successRate,
        lastRun: runs[0]?.startedAt || null,
      },
    });
  } catch (error) {
    console.error("Automation detail error:", error);
    return NextResponse.json({ error: "Unable to load automation details." }, { status: 500 });
  }
}
