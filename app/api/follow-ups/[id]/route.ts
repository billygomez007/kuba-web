import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { followUps } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });

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

    const existing = await db
      .select({ id: followUps.id })
      .from(followUps)
      .where(
        and(
          eq(
            followUps.id,
            id,
          ),
          eq(
            followUps.businessId,
            membership.businessId,
          ),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json(
        { error: "Follow-up not found." },
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
            membership.businessId,
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
