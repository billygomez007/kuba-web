import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessUsers,
  followUps,
  salesActivities,
} from "@/db/schema";


export async function POST(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
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

    const { id } = await context.params;

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


    const followUpResult = await db
      .select()
      .from(followUps)
      .where(
        and(
          eq(
            followUps.id,
            id,
          ),
          eq(
            followUps.businessId,
            business.businessId,
          ),
        ),
      )
      .limit(1);


    const followUp = followUpResult[0];


    if (!followUp) {
      return NextResponse.json(
        { error: "Follow-up not found" },
        { status: 404 },
      );
    }


    await db
      .update(followUps)
      .set({
        status: "assigned_to_ai",
        updatedAt: new Date(),
      })
      .where(
        eq(
          followUps.id,
          id,
        ),
      );


    await db.insert(salesActivities).values({
      id: crypto.randomUUID(),
      businessId: business.businessId,
      leadId: followUp.leadId,
      employeeId: null,
      type: "ai_action",
      title: "Kuba Sales handling follow-up",
      description:
        "Kuba Sales has been assigned this follow-up task.",
      createdAt: new Date(),
    });


    return NextResponse.json({
      success: true,
      message:
        "Kuba Sales is handling this follow-up.",
    });


  } catch (error) {
    console.error(
      "AI follow-up handling error",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to assign follow-up.",
      },
      {
        status: 500,
      },
    );
  }
}
