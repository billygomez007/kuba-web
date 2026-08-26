import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiBusinessSettings, aiEmployeeActivities, aiEmployeeSettings, aiEmployees, integrations, knowledgeSources } from "@/db/schema";
import { createAuditLog } from "@/lib/auth/audit";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

async function getContext() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const membership = await getCurrentMembership();
  if (!membership) return { error: NextResponse.json({ error: "Business not found." }, { status: 404 }) };
  if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return { error: NextResponse.json({ error: "Forbidden." }, { status: 403 }) };
  if (!hasCapability(await getBusinessEntitlements(membership.businessId), "ai_workforce.deployment")) {
    return { error: NextResponse.json({ error: "Deployment requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "growth" }, { status: 403 }) };
  }
  return { session, membership };
}

export async function GET() {
  try {
    const value = await getContext();
    if (value.error) return value.error;
    const businessId = value.membership.businessId;
    const [employees, employeeSettings, businessSettings, sources, connections, activities] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select({ employeeId: aiEmployeeSettings.employeeId, workingHours: aiEmployeeSettings.workingHours }).from(aiEmployeeSettings),
      db.select({ businessDescription: aiBusinessSettings.businessDescription, productsAndServices: aiBusinessSettings.productsAndServices, frequentlyAskedQuestions: aiBusinessSettings.frequentlyAskedQuestions }).from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, businessId)).limit(1),
      db.select({ id: knowledgeSources.id, employeeId: knowledgeSources.employeeId }).from(knowledgeSources).where(eq(knowledgeSources.businessId, businessId)),
      db.select({ provider: integrations.provider, status: integrations.status, metadata: integrations.metadata, externalPhoneNumberId: integrations.externalPhoneNumberId }).from(integrations).where(eq(integrations.businessId, businessId)),
      db.select({ employeeId: aiEmployeeActivities.employeeId, type: aiEmployeeActivities.type, description: aiEmployeeActivities.description, createdAt: aiEmployeeActivities.createdAt }).from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)),
    ]);
    const knowledge = businessSettings[0];
    const result = employees.map((employee) => {
      const settings = employeeSettings.find((item) => item.employeeId === employee.id);
      const employeeSources = sources.filter((source) => source.employeeId === null || source.employeeId === employee.id);
      const simulations = activities.filter((activity) => activity.employeeId === employee.id && activity.type === "simulation_completed");
      const employeeIntegrations = connections.filter((connection) => connection.status === "active" && !connection.metadata?.includes("voice_phone"));
      const voiceConfigured = activities.some((activity) => activity.employeeId === employee.id && activity.type === "voice.enabled");
      const dimensions = {
        knowledge: [Boolean(knowledge?.businessDescription || knowledge?.productsAndServices || knowledge?.frequentlyAskedQuestions), employeeSources.length > 0].filter(Boolean).length * 50,
        training: simulations.length ? 100 : 0,
        configuration: settings?.workingHours ? 100 : 50,
        permissions: employee.supervisionMode ? 100 : 0,
      };
      const readiness = Math.round((dimensions.knowledge + dimensions.training + dimensions.configuration + dimensions.permissions) / 4);
      const approved = readiness >= 70 && employee.status === "active";
      return { employee: { id: employee.id, name: employee.name, type: employee.type, status: employee.status }, readiness: { ...dimensions, overall: readiness }, certificationStatus: approved ? "Ready for review" : readiness >= 70 ? "Ready for review" : "Not ready", voiceConfigured, integrations: employeeIntegrations.map((item) => item.provider), knowledge: { businessInformation: Boolean(knowledge?.businessDescription), productsServices: Boolean(knowledge?.productsAndServices), faqs: Boolean(knowledge?.frequentlyAskedQuestions), customerInformation: true, uploadedDocuments: employeeSources.length }, automations: [], tests: { completed: simulations.length, lastScore: simulations.at(-1)?.description || null } };
    });
    return NextResponse.json({ employees: result, connections, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Deployment overview error:", error);
    return NextResponse.json({ error: "Unable to load deployment overview." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const value = await getContext();
    if (value.error) return value.error;
    if (!hasPermission(value.membership.role, value.membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body = await request.json();
    const employeeId = typeof body.employeeId === "string" ? body.employeeId : "";
    const employee = (await db.select({ id: aiEmployees.id, status: aiEmployees.status, name: aiEmployees.name }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, value.membership.businessId))).limit(1))[0];
    if (!employee) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    if (employee.status !== "active") return NextResponse.json({ error: "Activate the AI employee before deployment." }, { status: 400 });
    const now = new Date();
    await db.insert(aiEmployeeActivities).values({ id: crypto.randomUUID(), businessId: value.membership.businessId, employeeId, type: "deployment_completed", title: "AI employee deployed", description: "Deployment completed through the workforce deployment center.", status: "completed", createdAt: now });
    await createAuditLog({ businessId: value.membership.businessId, userId: value.session.user.id, action: "workforce.employee.deployed", resource: "ai_employee", resourceId: employeeId, description: `Deployed ${employee.name}.` });
    return NextResponse.json({ success: true, status: "LIVE" });
  } catch (error) {
    console.error("Deployment action error:", error);
    return NextResponse.json({ error: "Unable to deploy AI employee." }, { status: 500 });
  }
}
