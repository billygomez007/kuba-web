import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { actionApprovals, aiEmployeeActivities, aiEmployeeTeams, aiEmployees, auditLogs, automationRuns, businessTeamMembers, businessTeams, businessUsers, conversations, handoffs, leads, tasks, users } from "@/db/schema";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getCurrentMembership();
    const business = membership;
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const businessId = business.businessId;
    const [humans, employees, departments, teamMembers, aiAssignments, handoffRows, activityRows, audits, runs, conversationRows, leadRows, taskRows, approvals] = await Promise.all([
      db.select({ membershipId: businessUsers.id, userId: users.id, name: users.name, email: users.email, role: businessUsers.role, status: users.status }).from(businessUsers).innerJoin(users, eq(users.id, businessUsers.userId)).where(eq(businessUsers.businessId, businessId)),
      db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status, supervisorUserId: aiEmployees.supervisorUserId }).from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(businessTeams).where(eq(businessTeams.businessId, businessId)),
      db.select({ teamId: businessTeamMembers.teamId, businessUserId: businessTeamMembers.businessUserId }).from(businessTeamMembers),
      db.select({ teamId: aiEmployeeTeams.teamId, aiEmployeeId: aiEmployeeTeams.aiEmployeeId }).from(aiEmployeeTeams).innerJoin(businessTeams, eq(aiEmployeeTeams.teamId, businessTeams.id)).where(eq(businessTeams.businessId, businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)).orderBy(desc(handoffs.createdAt)).limit(50),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(40),
      db.select().from(auditLogs).where(eq(auditLogs.businessId, businessId)).orderBy(desc(auditLogs.createdAt)).limit(40),
      db.select({ id: automationRuns.id, status: automationRuns.status, triggerType: automationRuns.triggerType, startedAt: automationRuns.startedAt }).from(automationRuns).where(eq(automationRuns.businessId, businessId)).orderBy(desc(automationRuns.startedAt)).limit(40),
      db.select({ id: conversations.id, assignedEmployeeId: conversations.assignedEmployeeId, status: conversations.status }).from(conversations).where(eq(conversations.businessId, businessId)),
      db.select({ id: leads.id, assignedEmployeeId: leads.assignedEmployeeId }).from(leads).where(eq(leads.businessId, businessId)),
      db.select({ id: tasks.id, assignedEmployeeId: tasks.assignedEmployeeId, status: tasks.status }).from(tasks).where(eq(tasks.businessId, businessId)),
      db.select({ id: actionApprovals.id }).from(actionApprovals).where(and(eq(actionApprovals.businessId, businessId), eq(actionApprovals.status, "pending"))),
    ]);

    const departmentById = new Map(departments.map((department) => [department.id, department]));
    const humanTeamIds = new Map<string, string[]>();
    for (const item of teamMembers) humanTeamIds.set(item.businessUserId, [...(humanTeamIds.get(item.businessUserId) || []), item.teamId]);
    const aiTeamIds = new Map<string, string[]>();
    for (const item of aiAssignments) aiTeamIds.set(item.aiEmployeeId, [...(aiTeamIds.get(item.aiEmployeeId) || []), item.teamId]);
    const departmentName = (type: string) => type === "sales" ? "Sales" : type === "customer-support" || type === "receptionist" ? "Customer Support" : type === "general-manager" ? "Executive" : "Operations";
    const unifiedHumans = humans.map((human) => ({ ...human, type: "Human", department: humanTeamIds.get(human.membershipId)?.map((id) => departmentById.get(id)?.name).filter(Boolean)[0] || human.role }));
    const unifiedAI = employees.map((employee) => ({ ...employee, type: "AI Employee", department: aiTeamIds.get(employee.id)?.map((id) => departmentById.get(id)?.name).filter(Boolean)[0] || departmentName(employee.type) }));
    const activity = [
      ...activityRows.map((item) => ({ id: `ai-${item.id}`, actor: employees.find((employee) => employee.id === item.employeeId)?.name || "AI employee", type: "AI action", title: item.title, description: item.description, createdAt: item.createdAt })),
      ...audits.map((item) => ({ id: `audit-${item.id}`, actor: humans.find((human) => human.userId === item.userId)?.name || "Team member", type: "Human action", title: item.action, description: item.description, createdAt: item.createdAt })),
      ...handoffRows.map((item) => ({ id: `handoff-${item.id}`, actor: employees.find((employee) => employee.id === item.fromEmployeeId)?.name || "AI employee", type: "Collaboration", title: "Work handed off", description: item.reason, createdAt: item.createdAt })),
      ...runs.map((item) => ({ id: `run-${item.id}`, actor: "Automation Engine", type: "Automation", title: `Automation ${item.status}`, description: item.triggerType, createdAt: item.startedAt })),
    ].sort((first, second) => second.createdAt.getTime() - first.createdAt.getTime()).slice(0, 60);

    return NextResponse.json({
      humans: unifiedHumans,
      aiEmployees: unifiedAI,
      departments: departments.map((department) => ({ ...department, humans: unifiedHumans.filter((human) => human.department === department.name), aiEmployees: unifiedAI.filter((employee) => employee.department === department.name) })),
      assignments: aiAssignments,
      handoffs: handoffRows.map((handoff) => ({ ...handoff, employeeName: employees.find((employee) => employee.id === handoff.fromEmployeeId)?.name || "AI employee", humanName: humans.find((human) => human.userId === handoff.toUserId)?.name || null })),
      activity,
      metrics: {
        totalWorkforce: humans.length + employees.length,
        humanEmployees: humans.length,
        aiEmployees: employees.length,
        activeWorkers: humans.filter((human) => human.status === "active").length + employees.filter((employee) => employee.status === "active").length,
        departments: departments.length,
        currentWorkload: conversationRows.length + taskRows.filter((task) => task.status !== "completed").length,
        pendingApprovals: approvals.length,
        openEscalations: handoffRows.filter((handoff) => handoff.status !== "completed").length,
        humanConversations: conversationRows.filter((conversation) => !conversation.assignedEmployeeId).length,
        aiConversations: conversationRows.filter((conversation) => Boolean(conversation.assignedEmployeeId)).length,
        humanTasks: taskRows.filter((task) => !task.assignedEmployeeId && task.status === "completed").length,
        aiTasks: taskRows.filter((task) => Boolean(task.assignedEmployeeId) && task.status === "completed").length,
        humanLeads: leadRows.filter((lead) => !lead.assignedEmployeeId).length,
        aiLeads: leadRows.filter((lead) => Boolean(lead.assignedEmployeeId)).length,
      },
    });
  } catch (error) {
    console.error("Workforce team error:", error);
    return NextResponse.json({ error: "Unable to load workforce team." }, { status: 500 });
  }
}
