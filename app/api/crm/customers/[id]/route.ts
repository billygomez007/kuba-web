import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { appointments, auditLogs, conversations, crmDeals, customers, handoffs, leads, messages, tasks } from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

const LIMIT_MAX = 100;
type Filter = "all" | "conversations" | "sales" | "tasks" | "appointments" | "ai";
const categoryFor = (type: string): Filter => type.startsWith("conversation") || type === "message" || type === "handoff" ? "conversations" : type.startsWith("lead") || type.startsWith("deal") || type === "audit" ? "sales" : type.startsWith("task") ? "tasks" : type.startsWith("appointment") ? "appointments" : "ai";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.CRM_VIEW)) return NextResponse.json({ error: "CRM access denied." }, { status: 403 });
  const { id } = await context.params;
  const params = new URL(request.url).searchParams;
  const filter = (params.get("filter") || "all") as Filter;
  const limit = Math.min(Math.max(Number(params.get("limit") || 50) || 50, 1), LIMIT_MAX);
  const cursor = params.get("cursor");
  const customer = (await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.businessId, membership.businessId))).limit(1))[0];
  if (!customer) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
  const [leadRows, deals, appointmentRows, taskRows, conversationRows] = await Promise.all([
    db.select().from(leads).where(and(eq(leads.customerId, id), eq(leads.businessId, membership.businessId))).orderBy(desc(leads.createdAt)).limit(LIMIT_MAX),
    db.select().from(crmDeals).where(and(eq(crmDeals.customerId, id), eq(crmDeals.businessId, membership.businessId))).orderBy(desc(crmDeals.updatedAt)).limit(LIMIT_MAX),
    db.select().from(appointments).where(and(eq(appointments.customerId, id), eq(appointments.businessId, membership.businessId))).orderBy(desc(appointments.startAt)).limit(LIMIT_MAX),
    db.select().from(tasks).where(and(eq(tasks.customerId, id), eq(tasks.businessId, membership.businessId))).orderBy(desc(tasks.createdAt)).limit(LIMIT_MAX),
    db.select().from(conversations).where(and(eq(conversations.customerId, id), eq(conversations.businessId, membership.businessId))).orderBy(desc(conversations.updatedAt)).limit(LIMIT_MAX),
  ]);
  const conversationIds = conversationRows.map((row) => row.id);
  const dealIds = deals.map((row) => row.id);
  const leadIds = leadRows.map((row) => row.id);
  const [messageRows, handoffRows, auditRows] = await Promise.all([
    conversationIds.length ? db.select().from(messages).where(and(eq(messages.businessId, membership.businessId), inArray(messages.conversationId, conversationIds))).orderBy(desc(messages.createdAt)).limit(LIMIT_MAX) : Promise.resolve([]),
    conversationIds.length ? db.select().from(handoffs).where(and(eq(handoffs.businessId, membership.businessId), inArray(handoffs.conversationId, conversationIds))).orderBy(desc(handoffs.createdAt)).limit(LIMIT_MAX) : Promise.resolve([]),
    db.select().from(auditLogs).where(eq(auditLogs.businessId, membership.businessId)).orderBy(desc(auditLogs.createdAt)).limit(LIMIT_MAX),
  ]);
  const relatedIds = new Set([...dealIds, ...leadIds]);
  const timeline = [
    ...conversationRows.map((row) => ({ id: `conversation:${row.id}`, type: "conversation_started", category: "conversations", occurredAt: row.createdAt, title: "Conversation started", summary: `${row.status} conversation`, actor: row.assignedEmployeeId ? { employeeId: row.assignedEmployeeId } : null, relatedResource: { type: "conversation", id: row.id }, metadata: { channel: row.integrationId } })),
    ...messageRows.map((row) => ({ id: `message:${row.id}`, type: row.direction === "inbound" ? "inbound_message" : "outbound_message", category: row.senderType === "ai" ? "ai" : "conversations", occurredAt: row.createdAt, title: row.direction === "inbound" ? "Inbound message" : "Outbound message", summary: row.content.slice(0, 160), actor: row.senderId ? { id: row.senderId, type: row.senderType } : null, relatedResource: { type: "conversation", id: row.conversationId }, metadata: { messageType: row.messageType } })),
    ...handoffRows.map((row) => ({ id: `handoff:${row.id}`, type: "handoff", category: "conversations", occurredAt: row.createdAt, title: "Human handoff", summary: row.reason, actor: row.toUserId ? { userId: row.toUserId } : null, relatedResource: { type: "conversation", id: row.conversationId }, metadata: { status: row.status } })),
    ...leadRows.map((row) => ({ id: `lead:${row.id}`, type: "lead_created", category: "sales", occurredAt: row.createdAt, title: "Lead created", summary: row.stage || "Lead", actor: row.assignedEmployeeId ? { employeeId: row.assignedEmployeeId } : null, relatedResource: { type: "lead", id: row.id }, metadata: { source: row.source, stage: row.stage } })),
    ...deals.map((row) => ({ id: `deal:${row.id}`, type: "deal_updated", category: "sales", occurredAt: row.updatedAt, title: `Deal: ${row.title}`, summary: `${row.status}${row.value ? ` · ${row.currency || "GHS"} ${row.value}` : ""}`, actor: row.assignedUserId ? { userId: row.assignedUserId } : row.assignedEmployeeId ? { employeeId: row.assignedEmployeeId } : null, relatedResource: { type: "deal", id: row.id }, metadata: { status: row.status, value: row.value, stageId: row.stageId } })),
    ...appointmentRows.map((row) => ({ id: `appointment:${row.id}`, type: `appointment_${row.status}`, category: "appointments", occurredAt: row.startAt, title: row.title, summary: row.status, actor: row.assignedUserId ? { userId: row.assignedUserId } : null, relatedResource: { type: "appointment", id: row.id }, metadata: { timezone: row.timezone } })),
    ...taskRows.map((row) => ({ id: `task:${row.id}`, type: row.status === "completed" ? "task_completed" : "task_created", category: "tasks", occurredAt: row.updatedAt || row.createdAt, title: row.title, summary: row.status, actor: row.assignedUserId ? { userId: row.assignedUserId } : row.assignedEmployeeId ? { employeeId: row.assignedEmployeeId } : null, relatedResource: { type: "task", id: row.id }, metadata: { dueAt: row.dueAt, priority: row.priority } })),
    ...auditRows.filter((row) => relatedIds.has(row.resourceId || "") || JSON.stringify(row.metadata || "").includes(id)).map((row) => ({ id: `audit:${row.id}`, type: row.action, category: categoryFor(row.action), occurredAt: row.createdAt, title: row.action, summary: row.description || row.action, actor: row.userId ? { userId: row.userId } : null, relatedResource: { type: row.resource, id: row.resourceId }, metadata: row.metadata ? JSON.parse(row.metadata) : {} })),
  ].filter((entry) => filter === "all" || entry.category === filter).filter((entry) => !cursor || new Date(entry.occurredAt).getTime() < Number(cursor)).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  const page = timeline.slice(0, limit);
  const openDeals = deals.filter((deal) => deal.status === "open");
  const upcoming = appointmentRows.filter((row) => new Date(row.startAt).getTime() >= Date.now() && !["cancelled", "completed"].includes(row.status)).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime())[0] || null;
  const openTasks = taskRows.filter((row) => row.status !== "completed");
  const lastEntry = page.at(-1);
  const nextCursor = page.length === limit && lastEntry ? String(new Date(lastEntry.occurredAt).getTime()) : null;
  return NextResponse.json({ customer, summary: { activeLeads: leadRows.filter((lead) => !["converted", "lost"].includes(lead.dealStatus || "")).length, openDeals: openDeals.length, openDealValue: openDeals.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0), nextAppointment: upcoming, openTasks: openTasks.length, overdueTasks: openTasks.filter((task) => task.dueAt && new Date(task.dueAt).getTime() < Date.now()).length, lastActivityAt: timeline[0]?.occurredAt || customer.updatedAt }, leads: leadRows, deals, appointments: appointmentRows, tasks: taskRows, conversations: conversationRows, messages: messageRows.map(({ content, ...message }) => { void content; return message; }), timeline: page, pagination: { limit, nextCursor, hasMore: Boolean(nextCursor) } });
}
