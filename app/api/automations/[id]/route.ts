import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { automationRuns, automations } from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business access denied." }, { status: 403 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(membership.businessId), "business_ops.automations")) {
      return NextResponse.json({ error: "Automations require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["business_ops.automations"] }, { status: 403 });
    }

    const { id } = await context.params;
    const automationResult = await db
      .select()
      .from(automations)
      .where(and(eq(automations.id, id), eq(automations.businessId, membership.businessId)))
      .limit(1);
    const automation = automationResult[0];
    if (!automation) return NextResponse.json({ error: "Automation not found." }, { status: 404 });

    const runs = await db
      .select()
      .from(automationRuns)
      .where(and(eq(automationRuns.automationId, id), eq(automationRuns.businessId, membership.businessId)))
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
