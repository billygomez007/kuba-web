import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  conversations,
  messages,
  businessUsers,
} from "@/db/schema";

import { and, eq, desc } from "drizzle-orm";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{
      employeeId: string;
    }>;
  },
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

    const { employeeId } = await params;

    const membership =
      await db
        .select({
          businessId:
            businessUsers.businessId,
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
      return NextResponse.json({
        messages: [],
      });
    }

    const result =
      await db
        .select({
          id: messages.id,
          content: messages.content,
          senderType: messages.senderType,
          createdAt: messages.createdAt,
        })
        .from(messages)
        .innerJoin(
          conversations,
          eq(
            conversations.id,
            messages.conversationId,
          ),
        )
        .where(
          and(
            eq(
              conversations.businessId,
              business.businessId,
            ),
            eq(
              messages.senderId,
              employeeId,
            ),
          ),
        )
        .orderBy(
          desc(messages.createdAt),
        )
        .limit(50);

    return NextResponse.json({
      messages: result.reverse(),
    });

  } catch (error) {
    console.error(
      "Conversation history error",
      error,
    );

    return NextResponse.json({
      messages: [],
    });
  }
}
