import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployeeSettings, aiEmployees } from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

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
    const settings = await db.select().from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, id)).limit(1);
    return NextResponse.json({ employee: data.employee, settings: settings[0] || null });
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
    const autonomyLevel = ["assistant", "operator", "autonomous"].includes(body.autonomyLevel) ? body.autonomyLevel : "assistant";
    const existing = await db.select({ id: aiEmployeeSettings.id, roleInstructions: aiEmployeeSettings.roleInstructions }).from(aiEmployeeSettings).where(eq(aiEmployeeSettings.employeeId, id)).limit(1);
    const marker = "\n\nAutonomy controls:\n";
    const guidance = `${marker}Level: ${autonomyLevel}\nEnabled actions: ${Array.isArray(body.enabledActions) ? body.enabledActions.filter((item: unknown): item is string => typeof item === "string").join(", ") : ""}\nApproval-required actions: ${Array.isArray(body.approvalActions) ? body.approvalActions.filter((item: unknown): item is string => typeof item === "string").join(", ") : ""}`;
    const currentInstructions = existing[0]?.roleInstructions || "";
    const roleInstructions = currentInstructions.includes(marker) ? `${currentInstructions.slice(0, currentInstructions.indexOf(marker))}${guidance}` : `${currentInstructions}${guidance}`;
    const now = new Date();

    await db.update(aiEmployees).set({ supervisionMode: autonomyLevel, updatedAt: now }).where(and(eq(aiEmployees.id, id), eq(aiEmployees.businessId, data.membership.businessId)));
    if (existing[0]) await db.update(aiEmployeeSettings).set({ roleInstructions, updatedAt: now }).where(eq(aiEmployeeSettings.id, existing[0].id));
    else await db.insert(aiEmployeeSettings).values({ id: crypto.randomUUID(), employeeId: id, roleInstructions, createdAt: now, updatedAt: now });
    return NextResponse.json({ success: true, autonomyLevel });
  } catch (error) {
    console.error("Employee permissions POST error:", error);
    return NextResponse.json({ error: "Unable to save autonomy settings." }, { status: 500 });
  }
}
