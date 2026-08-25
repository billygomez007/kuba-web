import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  actionApprovals,
  aiEmployees,
  businessUsers,
  conversationRouting,
  conversations,
  followUps,
  handoffs,
  leads,
  messages,
  tasks,
  users,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";

export async function GET() {
  try {
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        { error: error || "Unauthorized" },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: error || "Business access denied." },
        { status: 403 },
      );
    }

    const [conversationRows, employeeRows, memberRows, messageRows, routingRows, handoffRows, leadRows, followUpRows, taskRows, approvalRows] = await Promise.all([
      db.select().from(conversations).where(eq(conversations.businessId, membership.businessId)).orderBy(desc(conversations.updatedAt)),
      db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, membership.businessId)),
      db.select({ id: businessUsers.id, userId: users.id, name: users.name, email: users.email }).from(businessUsers).innerJoin(users, eq(users.id, businessUsers.userId)).where(eq(businessUsers.businessId, membership.businessId)),
      db.select().from(messages).where(eq(messages.businessId, membership.businessId)).orderBy(desc(messages.createdAt)),
      db.select().from(conversationRouting).where(eq(conversationRouting.businessId, membership.businessId)),
      db.select().from(handoffs).where(eq(handoffs.businessId, membership.businessId)).orderBy(desc(handoffs.createdAt)),
      db.select().from(leads).where(eq(leads.businessId, membership.businessId)),
      db.select().from(followUps).where(eq(followUps.businessId, membership.businessId)),
      db.select().from(tasks).where(eq(tasks.businessId, membership.businessId)),
      db.select({ id: actionApprovals.id }).from(actionApprovals).where(and(eq(actionApprovals.businessId, membership.businessId), eq(actionApprovals.status, "pending"))),
    ]);

    const employeesById = new Map(employeeRows.map((employee) => [employee.id, employee]));
    const membersByUserId = new Map(memberRows.map((member) => [member.userId, member]));
    const messagesByConversation = new Map<string, typeof messageRows[number]>();

    for (const message of messageRows) {
      if (!messagesByConversation.has(message.conversationId)) {
        messagesByConversation.set(message.conversationId, message);
      }
    }

    const routingByConversation = new Map(routingRows.map((routing) => [routing.conversationId, routing]));
    const handoffByConversation = new Map(handoffRows.map((handoff) => [handoff.conversationId, handoff]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const inbox = conversationRows.map((conversation) => {
      const routing = routingByConversation.get(conversation.id);
      const latestMessage = messagesByConversation.get(conversation.id);
      const assignedEmployee = conversation.assignedEmployeeId
        ? employeesById.get(conversation.assignedEmployeeId)
        : routing?.aiEmployeeId
          ? employeesById.get(routing.aiEmployeeId)
          : undefined;
      const assignedUser = routing?.assignedUserId
        ? membersByUserId.get(routing.assignedUserId)
        : undefined;
      const handoff = handoffByConversation.get(conversation.id);
      const relatedLeads = leadRows.filter(
        (lead) => lead.customerId === conversation.customerId,
      );
      const relatedLeadIds = new Set(relatedLeads.map((lead) => lead.id));

      return {
        id: conversation.id,
        customerId: conversation.customerId,
        customerName: conversation.customerName || "Unknown customer",
        channel: conversation.integrationId,
        lastMessage: latestMessage?.content || "No messages yet.",
        lastMessageAt: latestMessage?.createdAt || conversation.updatedAt,
        assignedEmployee: assignedEmployee || null,
        assignedUser: assignedUser || null,
        assignedUserId: routing?.assignedUserId || null,
        status: conversation.status,
        routingStatus: routing?.status || conversation.aiMode,
        priority: routing?.priority || "normal",
        needsHuman: Boolean(
          handoff?.status === "pending" ||
          routing?.status === "waiting_for_human" ||
          routing?.status === "human_handling" ||
          conversation.status === "escalated",
        ),
        timeline: [
          ...relatedLeads.map((lead) => ({
            id: `lead-${lead.id}`,
            type: "lead",
            title: "Lead created",
            description: lead.service || lead.intent || "New customer opportunity",
            createdAt: lead.createdAt,
          })),
          ...followUpRows
            .filter((followUp) => relatedLeadIds.has(followUp.leadId))
            .map((followUp) => ({
              id: `follow-up-${followUp.id}`,
              type: "follow-up",
              title: "Follow-up scheduled",
              description: followUp.title,
              createdAt: followUp.createdAt,
            })),
          ...(handoff
            ? [{
                id: `handoff-${handoff.id}`,
                type: "handoff",
                title: "Human handoff",
                description: handoff.reason,
                createdAt: handoff.createdAt,
              }]
            : []),
        ].sort(
          (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
        ),
      };
    });

    const responseTimes: number[] = [];
    const messagesByConversationForTiming = new Map<string, typeof messageRows>();

    for (const message of messageRows) {
      const current = messagesByConversationForTiming.get(message.conversationId) || [];
      current.push(message);
      messagesByConversationForTiming.set(message.conversationId, current);
    }

    for (const conversationMessages of messagesByConversationForTiming.values()) {
      let inboundAt: Date | null = null;
      for (const message of [...conversationMessages].reverse()) {
        if (message.direction === "inbound") {
          inboundAt = message.createdAt;
        } else if (message.direction === "outbound" && inboundAt) {
          responseTimes.push(message.createdAt.getTime() - inboundAt.getTime());
          inboundAt = null;
        }
      }
    }

    const responseTimeMinutes = responseTimes.length
      ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length / 60000)
      : null;

    return NextResponse.json({
      success: true,
      conversations: inbox,
      handoffs: handoffRows.map((handoff) => {
        const conversation = conversationRows.find((item) => item.id === handoff.conversationId);
        const routing = routingByConversation.get(handoff.conversationId);
        return {
          ...handoff,
          customerName: conversation?.customerName || "Unknown customer",
          conversationStatus: conversation?.status || "unknown",
          assignedUser: handoff.toUserId ? membersByUserId.get(handoff.toUserId) || null : null,
          assignedTeamId: routing?.teamId || null,
          priority: routing?.priority || "normal",
        };
      }),
      employees: employeeRows,
      members: memberRows,
      metrics: {
        totalConversations: conversationRows.length,
        activeConversations: conversationRows.filter((conversation) => conversation.status !== "resolved").length,
        responseTimeMinutes,
        customerSatisfaction: null,
        conversationsToday: conversationRows.filter((conversation) => conversation.updatedAt >= today).length,
        leads: leadRows.length,
        followUps: followUpRows.filter((followUp) => followUp.status !== "completed").length,
        tasksCompleted: taskRows.filter((task) => task.status === "completed" && task.completedAt && task.completedAt >= today).length,
        pendingApprovals: approvalRows.length,
      },
    });
  } catch (error) {
    console.error("Customer operations workspace error:", error);
    return NextResponse.json(
      { error: "Unable to load customer operations." },
      { status: 500 },
    );
  }
}
