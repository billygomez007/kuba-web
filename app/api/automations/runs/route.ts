import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  automationRuns,
  automations,
  businessUsers,
} from "@/db/schema";


export async function GET() {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
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
        {
          status: 404,
        },
      );
    }

    const runs =
      await db
        .select({
          id:
            automationRuns.id,

          automationId:
            automationRuns.automationId,

          automationName:
            automations.name,

          triggerType:
            automationRuns.triggerType,

          triggerData:
            automationRuns.triggerData,

          status:
            automationRuns.status,

          error:
            automationRuns.error,

          startedAt:
            automationRuns.startedAt,

          completedAt:
            automationRuns.completedAt,
        })
        .from(automationRuns)
        .innerJoin(
          automations,
          eq(
            automationRuns.automationId,
            automations.id,
          ),
        )
        .where(
          and(
            eq(
              automationRuns.businessId,
              business.businessId,
            ),
            eq(
              automations.businessId,
              business.businessId,
            ),
          ),
        )
        .orderBy(
          desc(
            automationRuns.startedAt,
          ),
        )
        .limit(100);

    return NextResponse.json({
      runs,
    });

  } catch (error) {
    console.error(
      "Automation runs error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load automation history.",
      },
      {
        status: 500,
      },
    );
  }
}
