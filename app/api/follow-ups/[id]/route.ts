import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  businessUsers,
  followUps,
} from "@/db/schema";

export async function PATCH(
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

    const body = await request.json();

    const status = String(
      body.status || "",
    ).trim();

    if (!status) {
      return NextResponse.json(
        { error: "Status is required." },
        { status: 400 },
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
        { error: "Business not found." },
        { status: 404 },
      );
    }

    await db
      .update(followUps)
      .set({
        status,
        updatedAt: new Date(),
      })
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
      );

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error(
      "Follow-up update error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update follow-up.",
      },
      {
        status: 500,
      },
    );
  }
}
