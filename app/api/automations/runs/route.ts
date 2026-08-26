import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";

import {
  automationRuns,
  automations,
} from "@/db/schema";
import { getCurrentMembership, getCurrentUser } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";
import { capabilityMinimumPlan } from "@/lib/billing/plan-definitions";


export async function GET() {
  try {
    const [user, membership] = await Promise.all([getCurrentUser(), getCurrentMembership()]);
    if (!user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        },
      );
    }

    if (!membership) {
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
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    if (!hasCapability(await getBusinessEntitlements(membership.businessId), "business_ops.automations")) {
      return NextResponse.json({ error: "Automations require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: capabilityMinimumPlan["business_ops.automations"] }, { status: 403 });
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
              membership.businessId,
            ),
            eq(
              automations.businessId,
              membership.businessId,
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
