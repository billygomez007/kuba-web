import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals, aiBusinessSettings, aiEmployeeActivities, aiEmployeeSettings, aiEmployees, automationRuns, conversations, handoffs, integrations, knowledgeSources, leads, tasks } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

function departmentFor(type: string) {
  if (type === "sales") return "Revenue Operations";
  if (["receptionist", "customer-support", "appointment"].includes(type)) return "Customer Operations";
  if (type === "general-manager") return "Executive Operations";
  return "Business Operations";
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getCurrentMembership();
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const businessId = membership.businessId;
    const [employees, settings, brain, sources, connections, conversationsData, leadsData, tasksData, handoffsData, approvals, runs, activities] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select({ employeeId: aiEmployeeSettings.employeeId, workingHours: aiEmployeeSettings.workingHours, responsibilities: aiEmployeeSettings.responsibilities, communicationStyle: aiEmployeeSettings.communicationStyle }).from(aiEmployeeSettings).innerJoin(aiEmployees, eq(aiEmployees.id, aiEmployeeSettings.employeeId)).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, businessId)).limit(1),
      db.select().from(knowledgeSources).where(eq(knowledgeSources.businessId, businessId)),
      db.select().from(integrations).where(eq(integrations.businessId, businessId)),
      db.select().from(conversations).where(eq(conversations.businessId, businessId)),
      db.select().from(leads).where(eq(leads.businessId, businessId)),
      db.select().from(tasks).where(eq(tasks.businessId, businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)),
      db.select().from(actionApprovals).where(and(eq(actionApprovals.businessId, businessId), eq(actionApprovals.status, "pending"))),
      db.select().from(automationRuns).where(eq(automationRuns.businessId, businessId)),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(30),
    ]);
    const voiceConversations = conversationsData.filter((item) => item.integrationId === "voice-runtime");
    const activeCalls = voiceConversations.filter((item) => !["resolved", "closed"].includes(item.status));
    const failedRuns = runs.filter((item) => item.status === "failed").length;
    const activeRuns = runs.filter((item) => item.status === "active" || item.status === "running").length;
    const deployed = activities.filter((item) => item.type === "deployment_completed").map((item) => item.employeeId);
    const employeeRows = employees.map((employee) => {
      const employeeSettings = settings.find((item) => item.employeeId === employee.id);
      const employeeConversations = conversationsData.filter((item) => item.assignedEmployeeId === employee.id);
      const employeeHandoffs = handoffsData.filter((item) => item.fromEmployeeId === employee.id);
      const failed = activities.filter((item) => item.employeeId === employee.id && item.status === "failed").length;
      const performance = employeeConversations.length ? Math.max(0, Math.round(((employeeConversations.length - failed) / employeeConversations.length) * 100)) : null;
      const health = failed > 2 || employeeHandoffs.length > employeeConversations.length / 2 ? "Critical" : failed || employeeHandoffs.length ? "Needs attention" : "Healthy";
      return { id: employee.id, name: employee.name, type: employee.type, department: departmentFor(employee.type), status: deployed.includes(employee.id) ? "LIVE" : employee.status === "active" ? "TESTING" : "NEEDS ATTENTION", performance, health, channels: connections.filter((item) => item.status === "active").map((item) => item.provider), lifecycle: { created: true, training: Boolean(employeeSettings?.responsibilities), testing: activities.some((item) => item.employeeId === employee.id && item.type === "simulation_completed"), certification: activities.some((item) => item.employeeId === employee.id && item.type === "certification_completed"), deployment: deployed.includes(employee.id), monitoring: health === "Healthy" } };
    });
    const attentionCount = employeeRows.filter((item) => item.health === "Needs attention").length;
    const criticalCount = employeeRows.filter((item) => item.health === "Critical").length;
    const healthScore = employeeRows.length ? Math.round(((employeeRows.length - criticalCount - attentionCount * 0.5) / employeeRows.length) * 100) : null;
    const recommendations = [
      ...(!brain[0]?.productsAndServices ? ["Add products and services to Business Brain."] : []),
      ...(!brain[0]?.frequentlyAskedQuestions ? ["Add confirmed FAQs to improve employee answers."] : []),
      ...(failedRuns ? ["Review failed automation runs in Automation Center."] : []),
      ...(employees.some((item) => item.type === "receptionist" && !activities.some((activity) => activity.employeeId === item.id && activity.type === "voice.enabled")) ? ["Enable voice for Receptionist AI."] : []),
    ];
    return NextResponse.json({ overview: { totalEmployees: employees.length, activeEmployees: employees.filter((item) => item.status === "active").length, deployedEmployees: deployed.length, testingEmployees: employeeRows.filter((item) => item.status === "TESTING").length, attentionEmployees: employeeRows.filter((item) => item.status === "NEEDS ATTENTION").length, conversations: conversationsData.length, leads: leadsData.length, tasksCompleted: tasksData.filter((item) => item.status === "completed").length, revenueOpportunities: leadsData.filter((item) => item.stage !== "converted").length, healthScore, automationHealth: failedRuns ? "Needs attention" : "Healthy", knowledgeReadiness: brain[0] ? sources.length ? "Complete" : "Needs attention" : "Needs attention", certificationReadiness: employeeRows.filter((item) => item.lifecycle.certification).length, activeCalls: activeCalls.length, callsToday: voiceConversations.length, averageDuration: "Not tracked", transferRate: handoffsData.length ? Math.round((handoffsData.length / Math.max(voiceConversations.length, 1)) * 100) : 0, activeAutomations: activeRuns, successfulRuns: runs.filter((item) => item.status === "completed").length, failedRuns, humanTeam: membership.businessId ? "Available" : "Not available", handoffs: handoffsData.length, pendingApprovals: approvals.length }, employees: employeeRows, knowledge: { businessBrain: brain[0] ? "Complete" : "Needs attention", documents: sources.length, faqs: Boolean(brain[0]?.frequentlyAskedQuestions), products: Boolean(brain[0]?.productsAndServices), gaps: recommendations.filter((item) => item.includes("Business Brain") || item.includes("FAQs")) }, timeline: activities.slice(0, 15).map((item) => ({ id: item.id, title: item.title, description: item.description, type: item.type, status: item.status, createdAt: item.createdAt })), recommendations: [...new Set(recommendations)] });
  } catch (error) {
    console.error("Workforce control center error:", error);
    return NextResponse.json({ error: "Unable to load workforce control center." }, { status: 500 });
  }
}
