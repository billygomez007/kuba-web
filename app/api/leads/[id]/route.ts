import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { leads } from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const {
      user,
      membership,
      error,
    } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json(
        {
          error:
            error || "Unauthorized",
        },
        { status: 401 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        {
          error:
            error ||
            "Business access denied.",
        },
        { status: 403 },
      );
    }

    if (
      !hasPermission(
        membership.role,
        membership.permissions,
        PERMISSIONS.SALES_MANAGE,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage leads.",
        },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    const stage =
      String(body.stage || "").trim();

    const allowedStages = [
      "new",
      "qualified",
      "proposal",
      "won",
      "lost",
    ];

    if (
      !allowedStages.includes(stage)
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid sales stage.",
        },
        { status: 400 },
      );
    }

    const existing =
      await db
        .select({
          id: leads.id,
        })
        .from(leads)
        .where(
          and(
            eq(
              leads.id,
              id,
            ),
            eq(
              leads.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    if (!existing[0]) {
      return NextResponse.json(
        {
          error:
            "Lead not found.",
        },
        { status: 404 },
      );
    }

    await db
      .update(leads)
      .set({
        stage,
        updatedAt:
          new Date(),
      })
      .where(
        and(
          eq(
            leads.id,
            id,
          ),
          eq(
            leads.businessId,
            membership.businessId,
          ),
        ),
      );

    return NextResponse.json({
      success: true,
      stage,
    });
  } catch (error) {
    console.error(
      "Lead update error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update lead.",
      },
      { status: 500 },
    );
  }
}
