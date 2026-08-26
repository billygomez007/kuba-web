import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  actionApprovals,
  aiEmployeeActivities,
  aiEmployees,
  automationRuns,
  conversations,
  handoffs,
  messages,
} from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

function departmentFor(type: string) {
  if (type === "sales") return "Revenue Operations";
  if (["receptionist", "customer-support", "appointment"].includes(type)) return "Customer Operations";
  if (type === "general-manager") return "Executive Operations";
  if (type === "marketing") return "Growth Operations";
  if (["accountant", "finance"].includes(type)) return "Finance Operations";
  return "Business Operations";
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "ai_workforce.monitoring")) {
      return NextResponse.json({ error: "Monitoring requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
    }

    const businessId = business.businessId;
    const [employees, activities, conversationsData, handoffsData, approvalData, runData, messageData] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(100),
      db.select().from(conversations).where(eq(conversations.businessId, businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)).orderBy(desc(handoffs.createdAt)).limit(100),
      db.select().from(actionApprovals).where(and(eq(actionApprovals.businessId, businessId), eq(actionApprovals.status, "pending"))).orderBy(desc(actionApprovals.createdAt)).limit(100),
      db.select({ id: automationRuns.id, automationId: automationRuns.automationId, triggerType: automationRuns.triggerType, status: automationRuns.status, error: automationRuns.error, startedAt: automationRuns.startedAt, completedAt: automationRuns.completedAt }).from(automationRuns).where(eq(automationRuns.businessId, businessId)).orderBy(desc(automationRuns.startedAt)).limit(100),
      db.select({ id: messages.id, conversationId: messages.conversationId, senderType: messages.senderType, direction: messages.direction, createdAt: messages.createdAt }).from(messages).where(eq(messages.businessId, businessId)).orderBy(desc(messages.createdAt)).limit(500),
    ]);

    const messagesByConversation = new Map<string, typeof messageData>();
    for (const message of messageData) {
      const current = messagesByConversation.get(message.conversationId) || [];
      current.push(message);
      messagesByConversation.set(message.conversationId, current);
    }

    const employeeMonitoring = employees.map((employee) => {
      const assignedConversations = conversationsData.filter((conversation) => conversation.assignedEmployeeId === employee.id);
      const employeeHandoffs = handoffsData.filter((handoff) => handoff.fromEmployeeId === employee.id);
      const employeeActivities = activities.filter((activity) => activity.employeeId === employee.id);
      const failedInteractions = employeeActivities.filter((activity) => activity.status === "failed").length;
      const responseQuality = employeeActivities.length ? Math.max(0, Math.round(((employeeActivities.length - failedInteractions) / employeeActivities.length) * 100)) : null;
      const resolutionRate = assignedConversations.length ? Math.round((assignedConversations.filter((conversation) => conversation.status === "resolved").length / assignedConversations.length) * 100) : null;
      const escalationRate = assignedConversations.length ? Math.round((employeeHandoffs.length / assignedConversations.length) * 100) : 0;
      const incidentCount = failedInteractions + employeeHandoffs.filter((handoff) => handoff.status !== "completed").length;
      const lastActivity = employeeActivities[0]?.createdAt || null;
      const health = incidentCount >= 3 || (escalationRate >= 50 && assignedConversations.length > 0) ? "Critical" : incidentCount > 0 || responseQuality !== null && responseQuality < 80 ? "Needs attention" : responseQuality === null ? "Needs attention" : "Healthy";
      return { id: employee.id, name: employee.name, type: employee.type, department: departmentFor(employee.type), status: employee.status, responseQuality, resolutionRate, escalationRate, recentIncidents: incidentCount, lastActivity, health };
    });

    const incidents = [
      ...activities.filter((activity) => activity.status === "failed").map((activity) => ({ id: `activity-${activity.id}`, type: "Failed response", severity: "high", title: activity.title, detail: activity.description || "AI activity failed.", employeeName: employees.find((employee) => employee.id === activity.employeeId)?.name || "AI employee", status: "open", createdAt: activity.createdAt })),
      ...runData.filter((run) => run.status === "failed").map((run) => ({ id: `run-${run.id}`, type: "Automation failure", severity: "high", title: `Automation ${run.triggerType} failed`, detail: run.error || "Automation execution failed.", employeeName: "Automation Engine", status: "open", createdAt: run.startedAt })),
      ...handoffsData.filter((handoff) => handoff.status !== "completed").map((handoff) => ({ id: `handoff-${handoff.id}`, type: "Wrong routing", severity: "medium", title: "Handoff requires attention", detail: handoff.reason, employeeName: employees.find((employee) => employee.id === handoff.fromEmployeeId)?.name || "AI employee", status: handoff.status, createdAt: handoff.createdAt })),
      ...approvalData.map((approval) => ({ id: `approval-${approval.id}`, type: "Policy violation", severity: "medium", title: "Action awaiting approval", detail: approval.message, employeeName: employees.find((employee) => employee.id === approval.employeeId)?.name || "AI employee", status: "pending approval", createdAt: approval.createdAt })),
    ].sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime()).slice(0, 100);

    const auditTimeline = [
      ...activities.map((activity) => ({ id: `activity-${activity.id}`, type: "Employee action", title: activity.title, detail: activity.description, employeeName: employees.find((employee) => employee.id === activity.employeeId)?.name || "AI employee", createdAt: activity.createdAt })),
      ...handoffsData.map((handoff) => ({ id: `handoff-${handoff.id}`, type: "Handoff", title: "AI employee handoff", detail: handoff.reason, employeeName: employees.find((employee) => employee.id === handoff.fromEmployeeId)?.name || "AI employee", createdAt: handoff.createdAt })),
      ...runData.map((run) => ({ id: `run-${run.id}`, type: "Automation", title: `Automation ${run.status}`, detail: run.triggerType, employeeName: "Automation Engine", createdAt: run.startedAt })),
      ...approvalData.map((approval) => ({ id: `approval-${approval.id}`, type: "Approval", title: "Approval requested", detail: approval.message, employeeName: employees.find((employee) => employee.id === approval.employeeId)?.name || "AI employee", createdAt: approval.createdAt })),
      ...messageData.slice(0, 30).map((message) => ({ id: `message-${message.id}`, type: "Customer interaction", title: `${message.direction === "inbound" ? "Customer message" : "AI response"} received`, detail: message.senderType, employeeName: "Customer Operations", createdAt: message.createdAt })),
    ].sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime()).slice(0, 100);

    const criticalCount = employeeMonitoring.filter((employee) => employee.health === "Critical").length;
    const attentionCount = employeeMonitoring.filter((employee) => employee.health === "Needs attention").length;
    const healthScore = employees.length ? Math.round(((employees.length - criticalCount - attentionCount * 0.5) / employees.length) * 100) : null;
    const recommendations = [
      ...(activities.some((activity) => /price|pricing/i.test(activity.description || "")) ? ["Add pricing documentation to Business Brain."] : []),
      ...(handoffsData.length > 2 ? ["Review recurring handoffs and reduce unnecessary escalations."] : []),
      ...(employees.some((employee) => employee.type === "sales" && !activities.some((activity) => activity.employeeId === employee.id)) ? ["Update Sales AI instructions and complete a simulation."] : []),
      ...(runData.some((run) => run.status === "failed") ? ["Review failed automation executions and their trigger data."] : []),
    ];

    return NextResponse.json({
      overview: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((employee) => employee.status === "active").length,
        pausedEmployees: employees.filter((employee) => employee.status !== "active").length,
        failedInteractions: activities.filter((activity) => activity.status === "failed").length,
        escalations: handoffsData.length,
        automationFailures: runData.filter((run) => run.status === "failed").length,
        pendingApprovals: approvalData.length,
        healthScore,
        healthLabel: healthScore === null ? "Not tracked" : healthScore >= 90 ? "Excellent" : healthScore >= 75 ? "Healthy" : healthScore >= 50 ? "Needs attention" : "Critical",
      },
      employees: employeeMonitoring,
      incidents,
      auditTimeline,
      recommendations: [...new Set(recommendations)],
    });
  } catch (error) {
    console.error("Workforce monitoring error:", error);
    return NextResponse.json({ error: "Unable to load workforce monitoring." }, { status: 500 });
  }
}
