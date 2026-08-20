import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import {
  followUps,
  leads,
  conversations,
  messages,
  salesActivities,
} from "@/db/schema";

import { and, eq, desc } from "drizzle-orm";


export const getFollowUpContextTool = createTool({

  id: "get-follow-up-context",

  description:
    "Retrieves complete sales context for a follow-up including lead details, conversations, messages, and activities.",


  inputSchema: z.object({
    followUpId: z.string(),
  }),


  execute: async ({ followUpId }) => {

    const followUpResult = await db
      .select({
        followUp: followUps,
        lead: leads,
      })
      .from(followUps)
      .leftJoin(
        leads,
        eq(
          leads.id,
          followUps.leadId,
        ),
      )
      .where(
        eq(
          followUps.id,
          followUpId,
        ),
      )
      .limit(1);


    const item = followUpResult[0];


    if (!item) {
      return {
        error: "Follow-up not found",
      };
    }


    const customerMessages = item.lead?.customerId
      ? await db
          .select({
            message: messages,
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
            eq(
              conversations.customerId,
              item.lead.customerId,
            ),
          )
          .orderBy(
            desc(messages.createdAt),
          )
          .limit(20)
      : [];


    const activities = await db
      .select()
      .from(salesActivities)
      .where(
        eq(
          salesActivities.leadId,
          item.lead?.id || "",
        ),
      )
      .orderBy(
        desc(
          salesActivities.createdAt,
        ),
      )
      .limit(10);



    return {
      followUp: item.followUp,
      lead: item.lead,
      messages: customerMessages,
      activities,
    };

  },

});
