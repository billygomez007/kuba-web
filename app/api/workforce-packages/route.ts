import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, count, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployees, automations, integrations } from "@/db/schema";
import { getPackageTemplates, getWorkforcePackage, workforcePackages } from "@/lib/automations/packages";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessPlan, employeeLimitMessage, getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { getCurrentMembership } from "@/lib/auth/tenant";

async function context() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { session: null, membership: null };
  const membership = await getCurrentMembership();
  return { session, membership };
}

export async function GET() {
  try {
    const { session, membership } = await context();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasCapability(await getBusinessEntitlements(membership.businessId), "ai_workforce.marketplace")) {
      return NextResponse.json({ error: "Marketplace requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const [employeeRows, connectionRows, automationRows] = await Promise.all([
      db.select({ type: aiEmployees.type, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, membership.businessId)),
      db.select({ provider: integrations.provider, status: integrations.status }).from(integrations).where(eq(integrations.businessId, membership.businessId)),
      db.select({ name: automations.name }).from(automations).where(eq(automations.businessId, membership.businessId)),
    ]);

    return NextResponse.json({
      packages: workforcePackages.map((item) => {
        const templates = getPackageTemplates(item);
        const missingRequirements = [
          ...item.employees.filter((employee) => !employeeRows.some((existing) => existing.type === employee.type && existing.status === "active")).map((employee) => `${employee.name} required`),
          ...item.requiredIntegrations.filter((provider) => !connectionRows.some((connection) => connection.provider === provider && connection.status === "active")).map((provider) => `${provider} connection required`),
          ...templates.flatMap((template) => template.requiredEmployees.filter((type) => !employeeRows.some((employee) => employee.type === type && employee.status === "active")).map((type) => `${type} AI required`)),
          ...[PERMISSIONS.WORKFORCE_MANAGE, PERMISSIONS.AUTOMATIONS_MANAGE].filter((permission) => !hasPermission(membership.role, membership.permissions, permission)).map((permission) => `${permission} permission required`),
        ];
        const installed = item.employees.every((employee) => employeeRows.some((existing) => existing.type === employee.type)) && templates.every((template) => automationRows.some((automation) => automation.name === template.name));
        return { ...item, installed, missingRequirements: [...new Set(missingRequirements)] };
      }),
    });
  } catch (error) {
    console.error("Workforce packages GET error:", error);
    return NextResponse.json({ error: "Unable to load workforce packages." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { session, membership } = await context();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_MANAGE) || !hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_MANAGE)) {
      return NextResponse.json({ error: "You do not have permission to install workforce packages." }, { status: 403 });
    }
    if (!hasCapability(await getBusinessEntitlements(membership.businessId), "ai_workforce.marketplace")) {
      return NextResponse.json({ error: "Marketplace requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const body = await request.json();
    const selected = getWorkforcePackage(typeof body.packageId === "string" ? body.packageId.trim() : "");
    if (!selected) return NextResponse.json({ error: "Workforce package not found." }, { status: 404 });

    const [existingEmployees, connections, existingAutomations] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, membership.businessId)),
      db.select({ provider: integrations.provider, status: integrations.status }).from(integrations).where(eq(integrations.businessId, membership.businessId)),
      db.select({ name: automations.name }).from(automations).where(eq(automations.businessId, membership.businessId)),
    ]);
    const plan = await getBusinessPlan(membership.businessId);
    if (plan.employeeLimit !== null) {
      const activeCount = existingEmployees.filter((employee) => employee.status === "active").length;
      const newEmployees = selected.employees.filter((employee) => !existingEmployees.some((existing) => existing.type === employee.type)).length;
      if (activeCount + newEmployees > plan.employeeLimit) return NextResponse.json({ error: employeeLimitMessage(plan), upgradeRequired: true }, { status: 403 });
    }
    const templates = getPackageTemplates(selected);
    const missingRequirements = [
      ...selected.requiredIntegrations.filter((provider) => !connections.some((connection) => connection.provider === provider && connection.status === "active")).map((provider) => `${provider} connection required`),
      ...templates.flatMap((template) => template.requiredEmployees.filter((type) => !selected.employees.some((employee) => employee.type === type) && !existingEmployees.some((employee) => employee.type === type && employee.status === "active")).map((type) => `${type} AI required`)),
    ];
    if (missingRequirements.length) return NextResponse.json({ error: "Package requirements are not met.", missingRequirements: [...new Set(missingRequirements)] }, { status: 409 });

    const now = new Date();
    const employeeIds = new Map(existingEmployees.map((employee) => [employee.type, employee.id]));
    for (const employee of selected.employees) {
      if (!employeeIds.has(employee.type)) {
        const id = crypto.randomUUID();
        await db.insert(aiEmployees).values({ id, businessId: membership.businessId, branchId: membership.branchId || null, templateId: `package:${selected.id}`, name: employee.name, type: employee.type, description: employee.description, supervisionMode: "owner_supervised", supervisorUserId: session.user.id, status: "active", mastraAgentId: null, createdAt: now, updatedAt: now });
        employeeIds.set(employee.type, id);
      }
    }

    const installed = [];
    for (const template of templates) {
      if (existingAutomations.some((automation) => automation.name === template.name)) continue;
      const automation = { id: crypto.randomUUID(), businessId: membership.businessId, name: template.name, description: `${template.description} Installed with ${selected.name}.`, trigger: template.trigger, conditions: JSON.stringify(template.conditions), actions: JSON.stringify(template.actions), status: "active", createdAt: now, updatedAt: now };
      await db.insert(automations).values(automation);
      installed.push(automation.name);
    }

    return NextResponse.json({ success: true, packageId: selected.id, employeesCreated: selected.employees.filter((employee) => !existingEmployees.some((existing) => existing.type === employee.type)).map((employee) => employee.name), automationsInstalled: installed, knowledgeSetup: selected.knowledgeTemplates, setupSteps: selected.setupSteps }, { status: 201 });
  } catch (error) {
    console.error("Workforce package install error:", error);
    return NextResponse.json({ error: "Unable to install workforce package." }, { status: 500 });
  }
}
