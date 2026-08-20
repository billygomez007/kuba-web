import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  messages,
  conversations,
} from "@/db/schema";

import {
  canAccessConversation,
} from "@/lib/communications/conversation-access";

export async function GET(
  request: Request,
) {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { searchParams } =
      new URL(request.url);

    const conversationId =
      searchParams.get("id")?.trim();

    if (!conversationId) {
      return NextResponse.json(
        {
          error:
            "Conversation ID required.",
        },
        { status: 400 },
      );
    }

    /*
     * Central conversation access check.
     *
     * This prevents users from bypassing
     * the inbox restrictions by requesting
     * a conversation directly.
     */
    const access =
      await canAccessConversation(
        session.user.id,
        conversationId,
      );

    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            "You do not have access to this conversation.",
        },
        { status: 403 },
      );
    }

    const conversation =
      access.conversation;

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            "Conversation not found.",
        },
        { status: 404 },
      );
    }

    const conversationMessages =
      await db
        .select()
        .from(messages)
        .where(
          and(
            eq(
              messages.conversationId,
              conversationId,
            ),
            eq(
              messages.businessId,
              conversation.businessId,
            ),
          ),
        )
        .orderBy(
          desc(
            messages.createdAt,
          ),
        );

    return NextResponse.json({
      success: true,
      messages:
        conversationMessages.reverse(),
    });
  } catch (error) {
    console.error(
      "Conversation messages error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load messages.",
      },
      { status: 500 },
    );
  }
}
