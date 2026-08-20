import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessUsers,
  leads,
} from "@/db/schema";

export async function GET() {
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

    const membership =
      await db
        .select({
          businessId:
            businessUsers.businessId,
        })
        .from(businessUsers)
        .where(
          eq(
            businessUsers.userId,
            session.user.id,
          ),
        )
        .limit(1);

    const business =
      membership[0];

    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business not found.",
        },
        { status: 404 },
      );
    }

    const rows =
      await db
        .select({
          estimatedValue:
            leads.estimatedValue,

          currency:
            leads.currency,

          dealStatus:
            leads.dealStatus,

          stage:
            leads.stage,

          createdAt:
            leads.createdAt,

          closedAt:
            leads.closedAt,
        })
        .from(leads)
        .where(
          eq(
            leads.businessId,
            business.businessId,
          ),
        );

    let pipelineValue = 0;
    let openValue = 0;
    let wonValue = 0;
    let lostValue = 0;

    let openDeals = 0;
    let wonDeals = 0;
    let lostDeals = 0;

    for (const row of rows) {
      const value =
        Number(
          String(
            row.estimatedValue || "0",
          ).replace(
            /[^0-9.-]/g,
            "",
          ),
        ) || 0;

      const status =
        String(
          row.dealStatus || "open",
        ).toLowerCase();

      if (status === "won") {
        wonValue += value;
        wonDeals += 1;
      } else if (
        status === "lost"
      ) {
        lostValue += value;
        lostDeals += 1;
      } else {
        openValue += value;
        openDeals += 1;
      }

      if (
        status !== "lost"
      ) {
        pipelineValue += value;
      }
    }

    const totalDeals =
      openDeals +
      wonDeals +
      lostDeals;

    const winRate =
      totalDeals > 0
        ? Number(
            (
              (wonDeals /
                totalDeals) *
              100
            ).toFixed(1),
          )
        : 0;

    return NextResponse.json({
      currency: "GHS",

      pipeline: {
        totalValue: pipelineValue,
        openValue,
        openDeals,
      },

      revenue: {
        wonValue,
        wonDeals,
      },

      losses: {
        lostValue,
        lostDeals,
      },

      winRate,

      totalDeals,

      generatedAt:
        new Date().toISOString(),
    });

  } catch (error) {
    console.error(
      "Financial analytics error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load financial analytics.",
      },
      {
        status: 500,
      },
    );
  }
}
