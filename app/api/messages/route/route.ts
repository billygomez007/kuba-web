import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  conversations,
  aiEmployees,
  businessUsers,
} from "@/db/schema";

import {
  routeConversation,
} from "@/lib/ai-routing/router";

export async function POST(
  request: Request,
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();

    const {
      conversationId,
      message,
    } = body;

    if (!conversationId || !message) {
      return NextResponse.json(
        { error: "Missing data" },
        { status: 400 },
      );
    }

    const membership = await db
      .select({
        businessId: businessUsers.businessId,
      })
      .from(businessUsers)
      .where(
        eq(
          businessUsers.userId,
          session.user.id,
        ),
      )
      .limit(1);

    const business = membership[0];

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const conversation = await db
      .select({
        id: conversations.id,
      })
      .from(conversations)
      .where(
        and(
          eq(
            conversations.id,
            conversationId,
          ),
          eq(
            conversations.businessId,
            business.businessId,
          ),
        ),
      )
      .limit(1);

    if (!conversation[0]) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 },
      );
    }

    const routing =
      routeConversation(message);

    const employee =
      await db
        .select()
        .from(aiEmployees)
        .where(
          and(
            eq(
              aiEmployees.name,
              routing.employee,
            ),
            eq(
              aiEmployees.businessId,
              business.businessId,
            ),
            eq(
              aiEmployees.status,
              "active",
            ),
          ),
        )
        .limit(1);

    if (!employee[0]) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 },
      );
    }

    await db
      .update(conversations)
      .set({
        assignedEmployeeId:
          employee[0].id,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(
            conversations.id,
            conversationId,
          ),
          eq(
            conversations.businessId,
            business.businessId,
          ),
        ),
      );

    return NextResponse.json({
      success: true,
      assigned: employee[0].name,
      reason: routing.reason,
    });
  } catch (error) {
    console.error(
      "Message routing error:",
      error,
    );

    return NextResponse.json(
      { error: "Unable to route message" },
      { status: 500 },
    );
  }
}
