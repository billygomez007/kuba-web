import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businesses,
  businessUsers,
  salesActivities,
  leads,
} from "@/db/schema";

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const { searchParams } = new URL(request.url);

    const leadId =
      searchParams.get("leadId");

    const customerId =
      searchParams.get("customerId");

    if (!leadId && !customerId) {
      return NextResponse.json(
        {
          error:
            "leadId or customerId is required.",
        },
        { status: 400 },
      );
    }

    const businessResult = await db
      .select({
        business: businesses,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(businessUsers.businessId, businesses.id),
      )
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const business = businessResult[0]?.business;

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        { status: 404 },
      );
    }

    let activities;

    if (leadId) {

      activities = await db
        .select({
          id: salesActivities.id,
          type: salesActivities.type,
          title: salesActivities.title,
          description: salesActivities.description,
          createdAt: salesActivities.createdAt,
        })
        .from(salesActivities)
        .where(
          and(
            eq(
              salesActivities.businessId,
              business.id,
            ),
            eq(
              salesActivities.leadId,
              leadId,
            ),
          ),
        )
        .orderBy(
          desc(salesActivities.createdAt),
        );

    } else {

      activities = await db
        .select({
          id: salesActivities.id,
          type: salesActivities.type,
          title: salesActivities.title,
          description: salesActivities.description,
          createdAt: salesActivities.createdAt,
        })
        .from(salesActivities)
        .innerJoin(
          leads,
          eq(
            leads.id,
            salesActivities.leadId,
          ),
        )
        .where(
          and(
            eq(
              salesActivities.businessId,
              business.id,
            ),
            eq(
              leads.businessId,
              business.id,
            ),
            eq(
              leads.customerId,
              customerId!,
            ),
          ),
        )
        .orderBy(
          desc(salesActivities.createdAt),
        );

    }

    return NextResponse.json({
      success: true,
      activities,
    });
  } catch (error) {
    console.error(
      "Sales activities error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load sales activities.",
      },
      { status: 500 },
    );
  }
}
