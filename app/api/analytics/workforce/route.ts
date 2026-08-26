import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import {
  aiEmployees,
  conversations,
  handoffs,
  leads,
  messages,
  tasks,
} from "@/db/schema";

type CountItem = { label: string; count: number };

function topCounts(values: string[], limit = 5): CountItem[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim();
    if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function GET() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const business = await getCurrentMembership();
    if (!business) return NextResponse.json({ error: "Business not found." }, { status: 404 });
    if (!hasPermission(business.role, business.permissions, PERMISSIONS.ANALYTICS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "intelligence.ai_workforce")) {
      return NextResponse.json({ error: "AI Workforce Analytics requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 });
    }

    const businessId = business.businessId;
    const [employeeRows, conversationRows, messageRows, leadRows, taskRows, handoffRows] = await Promise.all([
      db.select().from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(conversations).where(eq(conversations.businessId, businessId)),
      db.select().from(messages).where(eq(messages.businessId, businessId)),
      db.select().from(leads).where(eq(leads.businessId, businessId)),
      db.select().from(tasks).where(eq(tasks.businessId, businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)),
    ]);

    const messagesByConversation = new Map<string, typeof messageRows>();
    for (const message of messageRows) {
      const current = messagesByConversation.get(message.conversationId) || [];
      current.push(message);
      messagesByConversation.set(message.conversationId, current);
    }

    const responseTimes: number[] = [];
    for (const conversationMessages of messagesByConversation.values()) {
      const ordered = [...conversationMessages].sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
      let inboundAt: Date | null = null;
      for (const message of ordered) {
        if (message.direction === "inbound") inboundAt = message.createdAt;
        if (message.direction === "outbound" && inboundAt) {
          responseTimes.push(message.createdAt.getTime() - inboundAt.getTime());
          inboundAt = null;
        }
      }
    }

    const averageResponseMinutes = responseTimes.length
      ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 60000)
      : null;
    const employees = employeeRows.map((employee) => {
      const employeeConversations = conversationRows.filter((conversation) => conversation.assignedEmployeeId === employee.id);
      return {
        id: employee.id,
        name: employee.name,
        type: employee.type,
        status: employee.status,
        conversations: employeeConversations.length,
        leads: leadRows.filter((lead) => lead.assignedEmployeeId === employee.id).length,
        tasksCompleted: taskRows.filter((task) => task.assignedEmployeeId === employee.id && task.status === "completed").length,
        escalations: handoffRows.filter((handoff) => handoff.fromEmployeeId === employee.id).length,
        trend: employeeConversations.length > 0 ? "Active" : "No recent activity",
      };
    });

    const channels = ["whatsapp", "website", "instagram", "facebook", "email", "voice"].map((channel) => {
      const channelConversations = conversationRows.filter((conversation) => conversation.integrationId === channel);
      const channelMessages = messageRows.filter((message) => message.integrationId === channel);
      const channelResponseTimes: number[] = [];
      for (const conversation of channelConversations) {
        const ordered = (messagesByConversation.get(conversation.id) || [])
          .filter((message) => message.integrationId === channel)
          .sort((first, second) => first.createdAt.getTime() - second.createdAt.getTime());
        let inboundAt: Date | null = null;
        for (const message of ordered) {
          if (message.direction === "inbound") inboundAt = message.createdAt;
          if (message.direction === "outbound" && inboundAt) {
            channelResponseTimes.push(message.createdAt.getTime() - inboundAt.getTime());
            inboundAt = null;
          }
        }
      }
      return {
        channel,
        conversations: channelConversations.length,
        responseTimeMinutes: channelResponseTimes.length
          ? Math.round(channelResponseTimes.reduce((sum, value) => sum + value, 0) / channelResponseTimes.length / 60000)
          : null,
        leads: leadRows.filter((lead) => lead.source?.toLowerCase().includes(channel)).length,
        messages: channelMessages.length,
      };
    });

    const inboundMessages = messageRows.filter((message) => message.direction === "inbound");
    const questions = topCounts(inboundMessages
      .filter((message) => message.content.includes("?"))
      .map((message) => message.content.trim().replace(/\s+/g, " ").slice(0, 90)));
    const services = topCounts(leadRows.map((lead) => lead.service || ""));
    const peakHours = topCounts(inboundMessages.map((message) => `${message.createdAt.getHours().toString().padStart(2, "0")}:00`), 3);

    return NextResponse.json({
      success: true,
      overview: {
        totalEmployees: employeeRows.length,
        activeEmployees: employeeRows.filter((employee) => employee.status === "active").length,
        conversationsHandled: conversationRows.length,
        leadsGenerated: leadRows.length,
        tasksCompleted: taskRows.filter((task) => task.status === "completed").length,
        humanEscalations: handoffRows.length,
        averageResponseMinutes,
      },
      employees,
      channels,
      customerIntelligence: {
        commonQuestions: questions,
        popularServices: services,
        peakEnquiryTimes: peakHours,
        sentiment: null,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Workforce analytics error:", error);
    return NextResponse.json({ error: "Unable to load workforce analytics." }, { status: 500 });
  }
}
