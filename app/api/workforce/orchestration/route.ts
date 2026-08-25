import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { aiEmployeeActivities, aiEmployees, automations, conversationRouting, conversations, handoffs } from "@/db/schema";
import { canAccessConversation } from "@/lib/communications/conversation-access";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const businessId = membership.businessId;
    const [employees, handoffRows, activities, workflowRows, conversationRows] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)).orderBy(desc(handoffs.createdAt)).limit(100),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(25),
      db.select().from(automations).where(and(eq(automations.businessId, businessId), eq(automations.status, "active"))),
      db.select({ id: conversations.id, customerName: conversations.customerName, assignedEmployeeId: conversations.assignedEmployeeId, status: conversations.status }).from(conversations).where(eq(conversations.businessId, businessId)).orderBy(desc(conversations.updatedAt)).limit(50),
    ]);

    const successfulHandoffs = handoffRows.filter((handoff) => handoff.status === "completed").length;
    const failedHandoffs = handoffRows.filter((handoff) => handoff.status === "failed").length;
    const resolved = handoffRows.filter((handoff) => handoff.status === "completed" && handoff.updatedAt >= handoff.createdAt).map((handoff) => handoff.updatedAt.getTime() - handoff.createdAt.getTime());

    return NextResponse.json({
      employees: employees.map((employee) => ({
        ...employee,
        department: employee.type === "sales" ? "Revenue" : employee.type === "customer-support" || employee.type === "receptionist" ? "Customer Operations" : "Business Operations",
        connectedEmployees: [...new Set(handoffRows.filter((handoff) => handoff.fromEmployeeId === employee.id).map((handoff) => handoff.toUserId).filter(Boolean))],
        activeWorkflows: workflowRows.filter((workflow) => workflow.actions.includes(employee.type)).length,
      })),
      conversations: conversationRows,
      handoffs: handoffRows.map((handoff) => ({ ...handoff, fromEmployeeName: employees.find((employee) => employee.id === handoff.fromEmployeeId)?.name || "AI employee" })),
      activities: activities.map((activity) => ({ ...activity, employeeName: employees.find((employee) => employee.id === activity.employeeId)?.name || "AI employee" })),
      rules: workflowRows.map((workflow) => ({ id: workflow.id, name: workflow.name, trigger: workflow.trigger, actions: workflow.actions })),
      performance: {
        successfulHandoffs,
        failedHandoffs,
        averageResolutionMinutes: resolved.length ? Math.round(resolved.reduce((sum, value) => sum + value, 0) / resolved.length / 60000) : null,
        mostActiveEmployee: activities.length ? employees.find((employee) => employee.id === activities[0].employeeId)?.name || null : null,
        collaborationEfficiency: handoffRows.length ? Math.round((successfulHandoffs / handoffRows.length) * 100) : null,
      },
    });
  } catch (error) {
    console.error("Workforce orchestration error:", error);
    return NextResponse.json({ error: "Unable to load workforce orchestration." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const membership = await getCurrentMembership();
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.MESSAGING_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const body = await request.json();
    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() : "";
    if (!conversationId || !employeeId) return NextResponse.json({ error: "Conversation and employee are required." }, { status: 400 });

    const conversation = await db.select({ id: conversations.id, businessId: conversations.businessId, assignedEmployeeId: conversations.assignedEmployeeId }).from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, membership.businessId))).limit(1);
    if (!conversation[0]) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const access = await canAccessConversation(session.user.id, conversationId);
    if (!access.allowed) return NextResponse.json({ error: "You do not have access to this conversation." }, { status: 403 });
    const employee = await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, membership.businessId), eq(aiEmployees.status, "active"))).limit(1);
    if (!employee[0]) return NextResponse.json({ error: "Active AI employee not found." }, { status: 404 });

    const routing = await db.select({ id: conversationRouting.id }).from(conversationRouting).where(eq(conversationRouting.conversationId, conversationId)).limit(1);
    const now = new Date();
    if (routing[0]) {
      await db.update(conversationRouting).set({ aiEmployeeId: employeeId, assignedUserId: null, assignmentType: "ai", status: "ai_handling", updatedAt: now }).where(eq(conversationRouting.id, routing[0].id));
    } else {
      await db.insert(conversationRouting).values({ id: crypto.randomUUID(), businessId: membership.businessId, conversationId, department: "operations", teamId: null, aiEmployeeId: employeeId, assignedUserId: null, assignmentType: "ai", status: "ai_handling", priority: "normal", confidence: 0, routingReason: "Transferred by workforce orchestration.", createdAt: now, updatedAt: now });
    }
    await db.update(conversations).set({ assignedEmployeeId: employeeId, updatedAt: now }).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, membership.businessId)));
    await db.insert(handoffs).values({
      id: crypto.randomUUID(),
      businessId: membership.businessId,
      conversationId,
      fromEmployeeId: conversation[0].assignedEmployeeId,
      toUserId: null,
      reason: `Transferred to AI employee ${employeeId} by workforce orchestration.`,
      status: "completed",
      createdAt: now,
      updatedAt: now,
    });
    return NextResponse.json({ success: true, employeeId });
  } catch (error) {
    console.error("Workforce handoff error:", error);
    return NextResponse.json({ error: "Unable to transfer work." }, { status: 500 });
  }
}
