import { and, eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  leads,
  conversations,
  messages,
  salesActivities,
} from "@/db/schema";


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


    const { leadId } = await request.json();


    const business = await getCurrentMembership();


    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }


    const leadResult = await db
      .select()
      .from(leads)
      .where(
        and(
          eq(
            leads.id,
            leadId,
          ),
          eq(
            leads.businessId,
            business.businessId,
          ),
        ),
      )
      .limit(1);


    const lead = leadResult[0];


    const activities = await db
      .select()
      .from(salesActivities)
      .where(
        eq(
          salesActivities.leadId,
          leadId,
        ),
      )
      .orderBy(
        desc(
          salesActivities.createdAt,
        ),
      )
      .limit(10);


    const customerMessages = await db
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
      .innerJoin(
        leads,
        eq(
          leads.customerId,
          conversations.customerId,
        ),
      )
      .where(
        and(
          eq(
            leads.id,
            leadId,
          ),
          eq(
            messages.businessId,
            business.businessId,
          ),
        ),
      )
      .orderBy(
        desc(
          messages.createdAt,
        ),
      )
      .limit(20);


    return NextResponse.json({
      lead,
      activities,
      messages: customerMessages,
    });


  } catch (error) {

    console.error(
      "Sales context error",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load sales context",
      },
      {
        status: 500,
      },
    );
  }
}
