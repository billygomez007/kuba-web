import { eq, desc } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  salesActivities,
  followUps,
  leads,
} from "@/db/schema";
import { getCurrentMembership } from "@/lib/auth/tenant";

export async function GET() {
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

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const [
      activities,
      upcomingFollowUps,
      pipeline,
    ] = await Promise.all([
      db
        .select()
        .from(salesActivities)
        .where(
          eq(
            salesActivities.businessId,
            business.businessId,
          ),
        )
        .orderBy(
          desc(salesActivities.createdAt),
        )
        .limit(5),

      db
        .select()
        .from(followUps)
        .where(
          eq(
            followUps.businessId,
            business.businessId,
          ),
        )
        .orderBy(
          followUps.dueAt,
        )
        .limit(5),

      db
        .select()
        .from(leads)
        .where(
          eq(
            leads.businessId,
            business.businessId,
          ),
        ),
    ]);


    return NextResponse.json({
      activities,
      followUps: upcomingFollowUps,
      pipeline,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Unable to load sales workspace",
      },
      {
        status: 500,
      },
    );
  }
}
