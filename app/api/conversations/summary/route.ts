import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  conversations,
  messages,
} from "@/db/schema";
import { kubaSalesAgent } from "@/mastra/agents/sales";
import {
  getBusinessMembership,
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

export async function POST(request: Request) {
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
  const conversationId = String(body.conversationId || "").trim();

  if (!conversationId) {
    return NextResponse.json(
      { error: "Conversation required." },
      { status: 400 },
    );
  }

  const conversationResult = await db
    .select({
      id: conversations.id,
      businessId: conversations.businessId,
    })
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);

  const conversation = conversationResult[0];

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversation not found." },
      { status: 404 },
    );
  }

  const membership = await getBusinessMembership(
    session.user.id,
    conversation.businessId,
  );

  if (!membership) {
    return NextResponse.json(
      { error: "Forbidden." },
      { status: 403 },
    );
  }

  if (
    !hasPermission(
      membership.role,
      membership.permissions,
      PERMISSIONS.MESSAGING_VIEW,
    )
  ) {
    return NextResponse.json(
      { error: "You do not have permission to view conversations." },
      { status: 403 },
    );
  }

  const conversationMessages = await db
    .select()
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.businessId, conversation.businessId),
      ),
    );

  const transcript = conversationMessages
    .map((m) => `${m.senderType}: ${m.content}`)
    .join("\n");

  const result = await kubaSalesAgent.generate(`
Analyze this customer conversation.

Conversation:

${transcript}

Return:

Customer intent:
Sentiment:
Recommended action:
Next step:

Keep it short.
`, {
    requestContext: new RequestContext([["businessId", conversation.businessId]]),
  });

  return NextResponse.json({
    summary: result.text,
  });
}
