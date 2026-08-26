import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  aiBusinessSettings,
  aiEmployeeActivities,
  aiEmployeeSettings,
  aiEmployees,
  integrations,
  knowledgeSources,
} from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

function departmentFor(type: string) {
  if (type === "sales") return "Revenue Operations";
  if (type === "receptionist" || type === "customer-support" || type === "appointment") return "Customer Operations";
  if (type === "general-manager" || type === "executive-assistant") return "Executive Operations";
  if (type === "marketing") return "Growth Operations";
  if (type === "accountant" || type === "finance") return "Finance Operations";
  return "Business Operations";
}

function parseSimulation(description: string | null) {
  if (!description) return null;
  try {
    const parsed = JSON.parse(description) as { recommendations?: unknown };
    return {
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.filter((item): item is string => typeof item === "string") : [],
    };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "ai_workforce.monitoring")) {
      return NextResponse.json({ error: "Certification readiness requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
    }

    const businessId = business.businessId;
    const [employees, settings, sources, activities, connections, businessSettings] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select({ settings: aiEmployeeSettings }).from(aiEmployeeSettings).innerJoin(aiEmployees, eq(aiEmployees.id, aiEmployeeSettings.employeeId)).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(knowledgeSources).where(eq(knowledgeSources.businessId, businessId)),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)),
      db.select({ provider: integrations.provider, status: integrations.status }).from(integrations).where(eq(integrations.businessId, businessId)),
      db.select({ businessDescription: aiBusinessSettings.businessDescription, productsAndServices: aiBusinessSettings.productsAndServices, frequentlyAskedQuestions: aiBusinessSettings.frequentlyAskedQuestions }).from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, businessId)).limit(1),
    ]);

    const businessKnowledge = businessSettings[0];
    const readiness = employees.map((employee) => {
      const employeeSettings = settings.find((item) => item.settings.employeeId === employee.id)?.settings;
      const employeeSources = sources.filter((source) => source.employeeId === null || source.employeeId === employee.id);
      const simulations = activities
        .filter((activity) => activity.employeeId === employee.id && activity.type === "simulation_completed")
        .map((activity) => parseSimulation(activity.description))
        .filter((simulation): simulation is NonNullable<ReturnType<typeof parseSimulation>> => Boolean(simulation));
      const autonomyConfigured = ["assistant", "operator", "autonomous"].includes(employee.supervisionMode);
      const approvalConfigured = Boolean(employeeSettings?.roleInstructions?.includes("Autonomy controls:"));
      const hasResponsibilities = Boolean(employeeSettings?.responsibilities?.trim());
      const hasCommunicationStyle = Boolean(employeeSettings?.communicationStyle?.trim());
      const hasWorkingHours = Boolean(employeeSettings?.workingHours?.trim());
      const hasBusinessKnowledge = Boolean(businessKnowledge?.businessDescription || businessKnowledge?.productsAndServices || businessKnowledge?.frequentlyAskedQuestions);
      const hasEscalation = Boolean(employeeSettings?.escalationRules?.trim() || employeeSettings?.handoffRules?.trim());
      const hasIntegration = connections.some((connection) => connection.status === "active");
      const knowledgeParts = [hasBusinessKnowledge, employeeSources.length > 0, Boolean(employeeSettings?.roleInstructions?.trim())];
      const configurationParts = [hasResponsibilities, hasCommunicationStyle, hasWorkingHours];
      const permissionParts = [autonomyConfigured, approvalConfigured, hasEscalation];
      const average = (parts: boolean[]) => parts.some(Boolean) ? Math.round((parts.filter(Boolean).length / parts.length) * 100) : null;
      // No "training score" is derived from simulations — a simulated
      // conversation has no authoritative quality methodology. Completing a
      // simulation is tracked as a real checklist fact instead of a fake
      // percentage. See PHASE 16/24 of the AI Workforce completion brief.
      const knowledgeScore = average(knowledgeParts);
      const configurationScore = average(configurationParts);
      const permissionScore = average(permissionParts);
      const dimensions = [knowledgeScore, configurationScore, permissionScore];
      const overallScore = dimensions.every((score): score is number => score !== null) ? Math.round(dimensions.reduce((sum, score) => sum + score, 0) / dimensions.length) : null;
      const checklist = {
        businessKnowledge: hasBusinessKnowledge,
        knowledgeSources: employeeSources.length > 0,
        responsibilities: hasResponsibilities,
        communicationStyle: hasCommunicationStyle,
        simulationCompleted: simulations.length > 0,
        approvalRules: approvalConfigured,
        humanEscalation: hasEscalation,
        deploymentSettings: hasIntegration && hasWorkingHours,
      };
      const complete = Object.values(checklist).every(Boolean);
      const status = employee.status !== "active" ? "Draft" : complete ? "Ready for Certification" : simulations.length > 0 ? "Testing" : employeeSettings ? "Training" : "Draft";
      const improvements = [
        ...(!checklist.businessKnowledge ? ["Connect Business Brain information."] : []),
        ...(!checklist.knowledgeSources ? ["Add knowledge sources for this employee."] : []),
        ...(!checklist.responsibilities ? ["Define primary responsibilities."] : []),
        ...(!checklist.communicationStyle ? ["Configure communication style."] : []),
        ...(!checklist.simulationCompleted ? ["Complete at least one workforce simulation."] : []),
        ...(!checklist.approvalRules ? ["Configure autonomy and approval rules."] : []),
        ...(!checklist.humanEscalation ? ["Configure human escalation guidance."] : []),
        ...(!checklist.deploymentSettings ? ["Complete deployment settings and connect an integration."] : []),
        ...simulations.flatMap((simulation) => simulation.recommendations),
      ];
      return {
        employee: { id: employee.id, name: employee.name, type: employee.type, department: departmentFor(employee.type), status: employee.status },
        scores: { knowledge: knowledgeScore, configuration: configurationScore, permissions: permissionScore, overall: overallScore },
        certificationStatus: status,
        checklist,
        improvements: [...new Set(improvements)],
        simulationCount: simulations.length,
      };
    });

    return NextResponse.json({ readiness, generatedAt: new Date().toISOString() });
  } catch (error) {
    console.error("Workforce certification error:", error);
    return NextResponse.json({ error: "Unable to load certification readiness." }, { status: 500 });
  }
}
