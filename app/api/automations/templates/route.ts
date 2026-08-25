import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { aiEmployees, automations, integrations } from "@/db/schema";
import { getAutomationTemplate, automationTemplates } from "@/lib/automations/templates";
import { hasPermission, PERMISSIONS, type Permission } from "@/lib/auth/permissions";
import { getBusinessPlan } from "@/lib/billing/entitlements";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";

async function getBusinessContext() {
  const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
  return { session: user ? { user } : null, membership };
}

export async function GET() {
  try {
    const { session, membership } = await getBusinessContext();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business not found." }, { status: 404 });

    const [employees, connections, installed] = await Promise.all([
      db.select({ type: aiEmployees.type, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, membership.businessId)),
      db.select({ provider: integrations.provider, status: integrations.status }).from(integrations).where(eq(integrations.businessId, membership.businessId)),
      db.select({ name: automations.name }).from(automations).where(eq(automations.businessId, membership.businessId)),
    ]);

    return NextResponse.json({
      templates: automationTemplates.map((item) => {
        const missingRequirements = [
          ...item.requiredEmployees.filter((type) => !employees.some((employee) => employee.type === type && employee.status === "active")).map((type) => `${type} AI required`),
          ...item.requiredIntegrations.filter((provider) => !connections.some((connection) => connection.provider === provider && connection.status === "active")).map((provider) => `${provider} connection required`),
          ...item.requiredPermissions.filter((permission) => !hasPermission(membership.role, membership.permissions, permission as Permission)).map((permission) => `${permission} permission required`),
        ];
        return { ...item, installed: installed.some((automation) => automation.name === item.name), missingRequirements };
      }),
    });
  } catch (error) {
    console.error("Automation templates GET error:", error);
    return NextResponse.json({ error: "Unable to load automation templates." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, membership } = await getBusinessContext();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_MANAGE)) {
      return NextResponse.json({ error: "You do not have permission to install automations." }, { status: 403 });
    }

    const plan = await getBusinessPlan(membership.businessId);
    if (plan.automationLimit !== null) {
      const existingCount = await db.select({ total: count() }).from(automations).where(eq(automations.businessId, membership.businessId));
      if (Number(existingCount[0]?.total || 0) >= plan.automationLimit) return NextResponse.json({ error: `You've reached the automation limit on ${plan.name}.`, upgradeRequired: true }, { status: 403 });
    }

    const body = await request.json();
    const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
    const selected = getAutomationTemplate(templateId);
    if (!selected) return NextResponse.json({ error: "Automation template not found." }, { status: 404 });

    const [employees, connections, existing] = await Promise.all([
      db.select({ type: aiEmployees.type, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, membership.businessId)),
      db.select({ provider: integrations.provider, status: integrations.status }).from(integrations).where(eq(integrations.businessId, membership.businessId)),
      db.select({ id: automations.id }).from(automations).where(and(eq(automations.businessId, membership.businessId), eq(automations.name, selected.name))).limit(1),
    ]);

    const missingRequirements = [
      ...selected.requiredEmployees.filter((type) => !employees.some((employee) => employee.type === type && employee.status === "active")).map((type) => `${type} AI required`),
      ...selected.requiredIntegrations.filter((provider) => !connections.some((connection) => connection.provider === provider && connection.status === "active")).map((provider) => `${provider} connection required`),
    ];
    if (missingRequirements.length) return NextResponse.json({ error: "Template requirements are not met.", missingRequirements }, { status: 409 });
    if (existing[0]) return NextResponse.json({ error: "This template is already installed." }, { status: 409 });

    const now = new Date();
    const automation = {
      id: crypto.randomUUID(),
      businessId: membership.businessId,
      name: selected.name,
      description: selected.description,
      trigger: selected.trigger,
      conditions: JSON.stringify(selected.conditions),
      actions: JSON.stringify(selected.actions),
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(automations).values(automation);
    return NextResponse.json({ success: true, automation }, { status: 201 });
  } catch (error) {
    console.error("Automation template install error:", error);
    return NextResponse.json({ error: "Unable to install automation template." }, { status: 500 });
  }
}
