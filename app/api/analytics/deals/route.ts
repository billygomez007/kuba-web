import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq, sql } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  leads,
} from "@/db/schema";

export async function GET(
  request: Request,
) {
  try {
    const session =
      await auth.api.getSession({
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
        {
          error:
            "Business not found.",
        },
        { status: 404 },
      );
    }

    const url =
      new URL(request.url);

    const status =
      (
        url.searchParams.get(
          "status",
        ) || "won"
      ).toLowerCase();

    const allowedStatuses = [
      "open",
      "won",
      "lost",
    ];

    if (
      !allowedStatuses.includes(
        status,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid deal status.",
        },
        { status: 400 },
      );
    }

    const rows =
      await db
        .select({
          id: leads.id,
          customerId: leads.customerId,
          name: leads.name,
          email: leads.email,
          phone: leads.phone,
          service: leads.service,
          destination:
            leads.destination,
          stage: leads.stage,
          estimatedValue:
            leads.estimatedValue,
          currency: leads.currency,
          dealStatus:
            leads.dealStatus,
          source: leads.source,
          createdAt:
            leads.createdAt,
          closedAt:
            leads.closedAt,
        })
        .from(leads)
        .where(
          and(
            eq(
              leads.businessId,
              business.businessId,
            ),
            sql`LOWER(COALESCE(${leads.dealStatus}, 'open')) = ${status}`,
          ),
        )
        .orderBy(
          sql`${leads.updatedAt} DESC`,
        );

    const deals =
      rows.map((row) => ({
        ...row,

        estimatedValue:
          Number(
            String(
              row.estimatedValue ||
                "0",
            ).replace(
              /[^0-9.-]/g,
              "",
            ),
          ) || 0,
      }));

    return NextResponse.json({
      status,
      deals,
      total: deals.length,
      generatedAt:
        new Date().toISOString(),
    });

  } catch (error) {
    console.error(
      "Analytics deals error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load analytics deals.",
      },
      {
        status: 500,
      },
    );
  }
}
