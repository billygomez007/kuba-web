import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import {
  businesses,
  followUps,
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
    const leadId = searchParams.get("leadId");

    if (!leadId) {
      return NextResponse.json(
        { error: "leadId is required." },
        { status: 400 },
      );
    }

    const membership = await getCurrentMembership();
    const business = membership
      ? (await db.select().from(businesses).where(eq(businesses.id, membership.businessId)).limit(1))[0]
      : null;

    if (!business) {
      return NextResponse.json(
        {
          error:
            "No business is associated with your account.",
        },
        { status: 404 },
      );
    }

    const results = await db
      .select({
        id: followUps.id,
        leadId: followUps.leadId,
        title: followUps.title,
        description: followUps.description,
        dueAt: followUps.dueAt,
        status: followUps.status,
        createdAt: followUps.createdAt,
      })
      .from(followUps)
      .where(
        and(
          eq(
            followUps.businessId,
            business.id,
          ),
          eq(
            followUps.leadId,
            leadId,
          ),
        ),
      )
      .orderBy(
        desc(followUps.dueAt),
      );

    return NextResponse.json({
      success: true,
      followUps: results,
    });
  } catch (error) {
    console.error(
      "Sales follow-ups error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load sales follow-ups.",
      },
      { status: 500 },
    );
  }
}
