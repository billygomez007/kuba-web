import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { actionApprovals, aiEmployeeActivities, auditLogs, automationRuns, automations, notifications, tasks } from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { buildOperationalMetrics } from "@/lib/operations/policy";

export async function GET() {
  try {
    const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: "Business access denied." }, { status: 403 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.DASHBOARD_VIEW)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const businessId = membership.businessId;
    const [taskRows, approvalRows, automationRows, runRows, notificationRows, aiActivityRows, auditRows] = await Promise.all([
      db.select().from(tasks).where(eq(tasks.businessId, businessId)).orderBy(desc(tasks.createdAt)),
      db.select().from(actionApprovals).where(eq(actionApprovals.businessId, businessId)).orderBy(desc(actionApprovals.createdAt)),
      db.select().from(automations).where(eq(automations.businessId, businessId)).orderBy(desc(automations.updatedAt)),
      db.select().from(automationRuns).where(eq(automationRuns.businessId, businessId)).orderBy(desc(automationRuns.startedAt)).limit(100),
      db.select().from(notifications).where(eq(notifications.businessId, businessId)).orderBy(desc(notifications.createdAt)).limit(50),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(20),
      db.select().from(auditLogs).where(eq(auditLogs.businessId, businessId)).orderBy(desc(auditLogs.createdAt)).limit(20),
    ]);

    const metrics = buildOperationalMetrics({ tasks: taskRows, approvals: approvalRows, automations: automationRows, runs: runRows }, businessId);
    const now = Date.now();
    const alerts = [
      ...taskRows.filter((task) => task.dueAt && task.dueAt.getTime() < now && !["completed", "cancelled"].includes(task.status)).map((task) => ({ id: `task:${task.id}`, type: "overdue_task", title: task.title, detail: `Task overdue since ${task.dueAt?.toISOString()}`, occurredAt: task.dueAt!, href: "/dashboard/tasks" })),
      ...runRows.filter((run) => run.status === "failed").map((run) => ({ id: `run:${run.id}`, type: "failed_automation", title: "Automation run failed", detail: run.error || `Run ${run.id} failed`, occurredAt: run.completedAt || run.startedAt, href: `/dashboard/automations/${run.automationId}` })),
      ...approvalRows.filter((approval) => approval.status === "pending").map((approval) => ({ id: `approval:${approval.id}`, type: "pending_approval", title: `${approval.channel} action awaiting approval`, detail: `Recipient: ${approval.recipient}`, occurredAt: approval.createdAt, href: "/dashboard/approvals" })),
      ...notificationRows.filter((notification) => !notification.readAt && !notification.archivedAt && ["operational", "integration_failure", "handoff"].includes(notification.type)).map((notification) => ({ id: `notification:${notification.id}`, type: notification.type, title: notification.title, detail: notification.body, occurredAt: notification.createdAt, href: notification.actionUrl || "/dashboard/business-operations/alerts" })),
    ].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    return NextResponse.json({
      metrics: { ...metrics, operationalAlerts: alerts.length },
      recentRuns: runRows.slice(0, 10),
      alerts: alerts.slice(0, 50),
      activity: [
        ...aiActivityRows.map((item) => ({ id: `ai:${item.id}`, actor: "AI", title: item.title, detail: item.description, occurredAt: item.createdAt })),
        ...auditRows.map((item) => ({ id: `audit:${item.id}`, actor: "Human/System", title: item.action, detail: item.description, occurredAt: item.createdAt })),
      ].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()).slice(0, 20),
    });
  } catch (error) {
    console.error("Business Operations GET error:", error);
    return NextResponse.json({ error: "Unable to load Business Operations." }, { status: 500 });
  }
}
