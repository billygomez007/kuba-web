import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { eq, desc } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  communicationLogs,
  businessUsers,
} from "@/db/schema";

export async function GET() {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "You must be signed in.",
        },
        {
          status: 401,
        },
      );
    }

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
        {
          error:
            "No business associated with this account.",
        },
        {
          status: 404,
        },
      );
    }

    const communications = await db
      .select()
      .from(communicationLogs)
      .where(
        eq(
          communicationLogs.businessId,
          business.businessId,
        ),
      )
      .orderBy(
        desc(
          communicationLogs.createdAt,
        ),
      );

    return NextResponse.json({
      success: true,
      communications,
    });

  } catch (error) {
    console.error(
      "Communication loading error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load communications.",
      },
      {
        status: 500,
      },
    );
  }
}
