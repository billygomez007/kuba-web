import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { aiEmployees, conversations, handoffs } from "@/db/schema";
import { auth } from "@/lib/auth";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

async function access() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const membership = await getCurrentMembership();
  if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_VIEW)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  if (!hasCapability(await getBusinessEntitlements(membership.businessId), "ai_workforce.voice")) {
    return { error: NextResponse.json({ error: "Voice requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "pro" }, { status: 403 }) };
  }
  return { membership, userId: session.user.id };
}

export async function GET() {
  const value = await access();
  if (value.error) return value.error;
  const rows = await db.select({ conversation: conversations, employeeName: aiEmployees.name }).from(conversations).leftJoin(aiEmployees, eq(aiEmployees.id, conversations.assignedEmployeeId)).where(and(eq(conversations.businessId, value.membership.businessId), eq(conversations.integrationId, "voice-runtime"), ne(conversations.status, "resolved"))).orderBy(desc(conversations.updatedAt));
  return NextResponse.json({ calls: rows.map(({ conversation, employeeName }) => ({ id: conversation.id, customer: conversation.customerName || conversation.customerPhone || "Unknown caller", phoneNumber: conversation.customerPhone || "", employee: employeeName || "Unassigned", status: conversation.status === "escalated" ? "Transferred" : conversation.aiMode === "active" ? "Connected" : "Processing", startedAt: conversation.createdAt, updatedAt: conversation.updatedAt })) });
}

export async function PATCH(request: Request) {
  const value = await access();
  if (value.error) return value.error;
  if (!hasPermission(value.membership.role, value.membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  const action = body.action === "transfer" ? "transfer" : body.action === "end" ? "end" : "";
  const conversation = (await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, value.membership.businessId), eq(conversations.integrationId, "voice-runtime"))).limit(1))[0];
  if (!conversation || !action) return NextResponse.json({ error: "Voice conversation not found." }, { status: 404 });
  const now = new Date();
  if (action === "transfer") {
    await db.update(conversations).set({ status: "escalated", aiMode: "paused", updatedAt: now }).where(eq(conversations.id, conversationId));
    await db.insert(handoffs).values({ id: crypto.randomUUID(), businessId: value.membership.businessId, conversationId, fromEmployeeId: conversation.assignedEmployeeId, toUserId: value.userId, reason: "Human transfer requested from live calls monitor.", status: "pending", createdAt: now, updatedAt: now });
  } else await db.update(conversations).set({ status: "resolved", aiMode: "paused", updatedAt: now }).where(eq(conversations.id, conversationId));
  return NextResponse.json({ success: true });
}
