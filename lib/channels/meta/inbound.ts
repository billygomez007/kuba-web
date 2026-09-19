import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  conversations,
  integrations,
  messages,
} from "@/db/schema";

import {
  resolveMetaIntegrationByExternalAccount,
} from "./integration";

import type {
  MetaChannel,
  MetaInboundMessage,
} from "./types";

export async function processMetaInboundMessage(
  incoming: MetaInboundMessage,
) {
  const resolved =
    await resolveMetaIntegrationByExternalAccount(
      incoming.channel,
      incoming.externalAccountId,
    );

  if (
    !resolved ||
    resolved.business.status !== "active"
  ) {
    return {
      status: 404,
      body: {
        error:
          "Unknown Meta connection.",
      },
    };
  }

  const integration =
    resolved.integration;

  const business =
    resolved.business;

  const existing =
    await db
      .select({
        id: messages.id,
      })
      .from(messages)
      .where(
        and(
          eq(
            messages.integrationId,
            integration.id,
          ),
          eq(
            messages.externalMessageId,
            incoming.externalMessageId,
          ),
        ),
      )
      .limit(1);

  if (existing[0]) {
    return {
      status: 200,
      body: {
        received: true,
        duplicate: true,
      },
    };
  }

  let conversation =
    (
      await db
        .select()
        .from(conversations)
        .where(
          and(
            eq(
              conversations.businessId,
              business.id,
            ),
            eq(
              conversations.integrationId,
              integration.id,
            ),
            eq(
              conversations.externalConversationId,
              incoming.senderId,
            ),
          ),
        )
        .limit(1)
    )[0];

  const now = new Date();

  if (!conversation) {
    const id =
      crypto.randomUUID();

    await db
      .insert(conversations)
      .values({
        id,
        businessId:
          business.id,
        integrationId:
          integration.id,
        externalConversationId:
          incoming.senderId,
        customerName:
          incoming.senderName ||
          incoming.senderId,
        customerPhone: null,
        customerEmail: null,
        assignedEmployeeId: null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });

    conversation =
      (
        await db
          .select()
          .from(conversations)
          .where(
            and(
              eq(
                conversations.id,
                id,
              ),
              eq(
                conversations.businessId,
                business.id,
              ),
            ),
          )
          .limit(1)
      )[0];
  }

  if (!conversation) {
    throw new Error(
      "Unable to create Meta conversation.",
    );
  }

  await db
    .insert(messages)
    .values({
      id:
        crypto.randomUUID(),
      businessId:
        business.id,
      conversationId:
        conversation.id,
      integrationId:
        integration.id,
      externalMessageId:
        incoming.externalMessageId,
      direction:
        "inbound",
      senderType:
        "customer",
      senderId:
        incoming.senderId,
      content:
        incoming.text,
      messageType:
        "text",
      metadata:
        JSON.stringify({
          channel:
            incoming.channel,
        }),
      createdAt: now,
    });

  await db
    .update(conversations)
    .set({
      customerName:
        incoming.senderName ||
        conversation.customerName,
      status: "open",
      updatedAt: now,
    })
    .where(
      and(
        eq(
          conversations.id,
          conversation.id,
        ),
        eq(
          conversations.businessId,
          business.id,
        ),
      ),
    );

  /*
   * A Meta connection becomes active only after
   * SuperKuba has received a valid signed provider
   * webhook for that exact external account.
   */
  await db
    .update(integrations)
    .set({
      status: "active",
      lastWebhookAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(
          integrations.id,
          integration.id,
        ),
        eq(
          integrations.businessId,
          business.id,
        ),
      ),
    );

  return {
    status: 200,
    body: {
      received: true,
      success: true,
      conversationId:
        conversation.id,
    },
  };
}
