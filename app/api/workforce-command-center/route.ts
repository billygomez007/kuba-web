import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { getBusinessDayBounds, getBusinessLocalization } from "@/lib/localization";
import {
  aiBusinessSettings,
  aiEmployeeActivities,
  aiEmployees,
  automations,
  conversations,
  handoffs,
  leads,
  messages,
} from "@/db/schema";

function counts(values: string[]) {
  const result = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized) result.set(normalized, (result.get(normalized) || 0) + 1);
  }
  return [...result.entries()].sort((first, second) => second[1] - first[1]).slice(0, 5).map(([label, count]) => ({ label, count }));
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.WORKFORCE_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "ai_workforce.performance")) {
      return NextResponse.json({ error: "AI Workforce Performance requires the Pro plan or higher.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const businessId = business.businessId;
    const [employees, conversationsData, messagesData, leadsData, handoffsData, activities, automationsData, settings] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(conversations).where(eq(conversations.businessId, businessId)),
      db.select().from(messages).where(eq(messages.businessId, businessId)).orderBy(desc(messages.createdAt)).limit(500),
      db.select().from(leads).where(eq(leads.businessId, businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)).orderBy(desc(handoffs.createdAt)).limit(100),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(12),
      db.select().from(automations).where(and(eq(automations.businessId, businessId), eq(automations.status, "active"))),
      db.select({ frequentlyAskedQuestions: aiBusinessSettings.frequentlyAskedQuestions }).from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, businessId)).limit(1),
    ]);

    const localization = await getBusinessLocalization(businessId);
    const { start: today } = getBusinessDayBounds(localization.timezone);
    const todayMessages = messagesData.filter((message) => message.createdAt >= today);
    const completedToday = activities.filter((activity) => activity.createdAt >= today && activity.status === "completed").length;
    const employeeMetrics = employees.map((employee) => {
      const employeeConversations = conversationsData.filter((conversation) => conversation.assignedEmployeeId === employee.id);
      const employeeMessages = messagesData.filter((message) => message.senderId === employee.id || employeeConversations.some((conversation) => conversation.id === message.conversationId));
      const inbound = employeeMessages.filter((message) => message.direction === "inbound");
      const outbound = employeeMessages.filter((message) => message.direction === "outbound");
      const resolved = employeeConversations.filter((conversation) => conversation.status === "resolved").length;
      const responseTimes: number[] = [];
      let inboundAt: Date | null = null;
      for (const message of [...employeeMessages].sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime())) {
        if (message.direction === "inbound") inboundAt = message.createdAt;
        if (message.direction === "outbound" && inboundAt) { responseTimes.push(message.createdAt.getTime() - inboundAt.getTime()); inboundAt = null; }
      }
      const responseTimeMinutes = responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 60000) : null;
      const resolutionRate = employeeConversations.length ? Math.round((resolved / employeeConversations.length) * 100) : null;
      const escalationRate = employeeConversations.length ? Math.round((handoffsData.filter((handoff) => handoff.fromEmployeeId === employee.id).length / employeeConversations.length) * 100) : 0;
      const performanceScore = employeeConversations.length ? Math.max(0, Math.min(100, Math.round((resolutionRate || 0) * 0.6 + Math.min(outbound.length, 20) * 2 - escalationRate * 0.4))) : null;
      const health = performanceScore === null ? "Needs attention" : performanceScore >= 75 && escalationRate < 20 ? "Healthy" : performanceScore >= 50 ? "Needs attention" : "Requires improvement";
      return { id: employee.id, name: employee.name, type: employee.type, status: employee.status, conversations: employeeConversations.length, responseTimeMinutes, resolutionRate, leads: leadsData.filter((lead) => lead.assignedEmployeeId === employee.id).length, escalationRate, performanceScore, health };
    }).sort((first, second) => (second.performanceScore || -1) - (first.performanceScore || -1));

    const activityFeed = activities.map((activity) => ({ ...activity, employeeName: employees.find((employee) => employee.id === activity.employeeId)?.name || "AI employee" }));
    const commonQuestions = counts(messagesData.filter((message) => message.direction === "inbound" && message.content.includes("?")).map((message) => message.content.slice(0, 100)));
    const knowledgeGaps = commonQuestions.filter((question) => !settings[0]?.frequentlyAskedQuestions?.toLowerCase().includes(question.label.toLowerCase()));

    return NextResponse.json({
      overview: {
        totalEmployees: employees.length,
        activeEmployees: employees.filter((employee) => employee.status === "active").length,
        conversationsToday: conversationsData.filter((conversation) => conversation.updatedAt >= today).length,
        tasksCompleted: completedToday,
        leadsGenerated: leadsData.length,
        escalations: handoffsData.length,
      },
      employees: employeeMetrics,
      health: {
        healthy: employeeMetrics.filter((employee) => employee.health === "Healthy").length,
        needsAttention: employeeMetrics.filter((employee) => employee.health === "Needs attention").length,
        requiresImprovement: employeeMetrics.filter((employee) => employee.health === "Requires improvement").length,
      },
      improvements: {
        knowledgeGaps,
        objections: counts(leadsData.map((lead) => lead.notes || "").filter((note) => /price|cost|delivery|payment|concern|expensive/i.test(note))),
        escalations: counts(handoffsData.map((handoff) => handoff.reason)),
        automationOpportunities: automationsData.length ? [] : ["Create an automation for recurring customer follow-ups."],
      },
      activity: activityFeed,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Workforce command center error:", error);
    return NextResponse.json({ error: "Unable to load workforce command center." }, { status: 500 });
  }
}
