import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessUsers,
  conversationRouting,
  conversations,
} from "@/db/schema";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { canAccessConversation } from "@/lib/communications/conversation-access";

export async function POST(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";

    if (!conversationId || !userId) {
      return NextResponse.json({ error: "Conversation and team member are required." }, { status: 400 });
    }

    const conversation = await db
      .select({ id: conversations.id, businessId: conversations.businessId })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);

    const targetConversation = conversation[0];
    if (!targetConversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const membership = await getBusinessMembership(session.user.id, targetConversation.businessId);
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.MESSAGING_MANAGE)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const access = await canAccessConversation(session.user.id, conversationId);
    if (!access.allowed) {
      return NextResponse.json({ error: "You do not have access to this conversation." }, { status: 403 });
    }

    const targetMember = await db
      .select({ id: businessUsers.id })
      .from(businessUsers)
      .where(and(eq(businessUsers.userId, userId), eq(businessUsers.businessId, targetConversation.businessId)))
      .limit(1);

    if (!targetMember[0]) {
      return NextResponse.json({ error: "Team member not found." }, { status: 404 });
    }

    const routing = await db
      .select({ id: conversationRouting.id })
      .from(conversationRouting)
      .where(eq(conversationRouting.conversationId, conversationId))
      .limit(1);

    if (routing[0]) {
      await db.update(conversationRouting).set({
        assignedUserId: userId,
        assignmentType: "user",
        status: "human_handling",
        updatedAt: new Date(),
      }).where(eq(conversationRouting.id, routing[0].id));
    } else {
      await db.insert(conversationRouting).values({
        id: crypto.randomUUID(),
        businessId: targetConversation.businessId,
        conversationId,
        department: "reception",
        teamId: null,
        aiEmployeeId: null,
        assignedUserId: userId,
        assignmentType: "user",
        status: "human_handling",
        priority: "normal",
        confidence: 0,
        routingReason: "Assigned to human team member.",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    await db.update(conversations).set({
      updatedAt: new Date(),
    }).where(and(eq(conversations.id, conversationId), eq(conversations.businessId, targetConversation.businessId)));

    return NextResponse.json({ success: true, userId });
  } catch (error) {
    console.error("Human conversation assignment error:", error);
    return NextResponse.json({ error: "Unable to assign conversation." }, { status: 500 });
  }
}
