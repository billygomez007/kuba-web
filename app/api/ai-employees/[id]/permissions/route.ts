import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployeeActionPolicies, aiEmployees } from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { createAuditLog } from "@/lib/auth/audit";
import {
  ACTION_META,
  AI_ACTIONS,
  AUTONOMY_LEVELS,
  getOrCreateActionPolicy,
  type AIAction,
  type AutonomyLevel,
  type PolicyDecision,
} from "@/lib/ai/authority";

async function employeeContext(employeeId: string) {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const employee = await db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status, supervisionMode: aiEmployees.supervisionMode }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, membership.businessId))).limit(1);
  return employee[0] ? { membership, employee: employee[0] } : null;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const data = await employeeContext(id);
    if (!data) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!hasPermission(data.membership.role, data.membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(data.membership.businessId), "ai_workforce.core")) {
      return NextResponse.json({ error: "AI Workforce requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "starter" }, { status: 403 });
    }
    const { autonomyLevel, policy } = await getOrCreateActionPolicy(data.membership.businessId, id);
    const actions = AI_ACTIONS.map((action) => ({
      action,
      ...ACTION_META[action],
      decision: policy[action] ?? "denied",
    }));
    return NextResponse.json({ employee: data.employee, autonomyLevel, actions });
  } catch (error) {
    console.error("Employee permissions GET error:", error);
    return NextResponse.json({ error: "Unable to load autonomy settings." }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await context.params;
    const data = await employeeContext(id);
    if (!data) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (!hasPermission(data.membership.role, data.membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "You do not have permission to configure this employee." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(data.membership.businessId), "ai_workforce.core")) {
      return NextResponse.json({ error: "AI Workforce requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "starter" }, { status: 403 });
    }

    const body = await request.json();
    const autonomyLevel: AutonomyLevel = AUTONOMY_LEVELS.includes(body.autonomyLevel) ? body.autonomyLevel : "operator";

    const submittedPolicy = (body.policy && typeof body.policy === "object" ? body.policy : {}) as Record<string, unknown>;
    const policy: Partial<Record<AIAction, PolicyDecision>> = {};
    for (const action of AI_ACTIONS) {
      // Communication can never be saved as anything other than
      // requires_approval, regardless of what the client sends — the same
      // hard floor lib/ai/authority.ts enforces at execution time.
      if (ACTION_META[action].kind === "communication") {
        policy[action] = "requires_approval";
        continue;
      }
      const submitted = submittedPolicy[action];
      policy[action] = submitted === "denied" || submitted === "allowed" || submitted === "requires_approval" ? submitted : "denied";
    }

    const now = new Date();
    const existing = await db.select({ id: aiEmployeeActionPolicies.id }).from(aiEmployeeActionPolicies).where(eq(aiEmployeeActionPolicies.employeeId, id)).limit(1);
    if (existing[0]) {
      await db.update(aiEmployeeActionPolicies).set({ autonomyLevel, policy: JSON.stringify(policy), updatedAt: now }).where(eq(aiEmployeeActionPolicies.id, existing[0].id));
    } else {
      await db.insert(aiEmployeeActionPolicies).values({ id: crypto.randomUUID(), businessId: data.membership.businessId, employeeId: id, autonomyLevel, policy: JSON.stringify(policy), createdAt: now, updatedAt: now });
    }
    // Kept in sync only as a legacy/display value — lib/ai/authority.ts
    // reads aiEmployeeActionPolicies exclusively for enforcement.
    await db.update(aiEmployees).set({ supervisionMode: autonomyLevel, updatedAt: now }).where(and(eq(aiEmployees.id, id), eq(aiEmployees.businessId, data.membership.businessId)));

    await createAuditLog({ businessId: data.membership.businessId, userId: session.user.id, action: "ai_employee.permissions.update", resource: "ai_employee", resourceId: id, description: `Updated autonomy settings for AI employee "${data.employee.name}".`, metadata: { autonomyLevel, policy } });

    const actions = AI_ACTIONS.map((action) => ({ action, ...ACTION_META[action], decision: policy[action] ?? "denied" }));
    return NextResponse.json({ success: true, autonomyLevel, actions });
  } catch (error) {
    console.error("Employee permissions POST error:", error);
    return NextResponse.json({ error: "Unable to save autonomy settings." }, { status: 500 });
  }
}
