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
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";


export const getFollowUpContextTool = createTool({

  id: "get-follow-up-context",

  description:
    "Retrieves complete sales context for a follow-up including lead details, conversations, messages, and activities.",


  inputSchema: z.object({
    followUpId: z.string(),
  }),


  execute: async ({ followUpId }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_follow_ups" });
    if (!decision.ok) return { error: decision.message };

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
        and(
          eq(
            followUps.id,
            followUpId,
          ),
          eq(
            followUps.businessId,
            businessId,
          ),
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
            and(
              eq(
                conversations.customerId,
                item.lead.customerId,
              ),
              eq(
                conversations.businessId,
                businessId,
              ),
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
        and(
          eq(
            salesActivities.leadId,
            item.lead?.id || "",
          ),
          eq(
            salesActivities.businessId,
            businessId,
          ),
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
