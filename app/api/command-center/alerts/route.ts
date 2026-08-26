import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

import {
  leads,
  followUps,
  aiEmployees,
} from "@/db/schema";

import { eq } from "drizzle-orm";


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


    const business = await getCurrentMembership();


    if (!business) {
      return NextResponse.json(
        {
          error: "Business not found",
        },
        {
          status: 404,
        },
      );
    }

    if (!hasPermission(business.role, business.permissions, PERMISSIONS.DASHBOARD_VIEW)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!hasCapability(await getBusinessEntitlements(business.businessId), "command_center.basic")) {
      return NextResponse.json({ error: "Command Center requires an active plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "starter" }, { status: 403 });
    }


    const [
      leadsData,
      followUpsData,
      employeesData,
    ] =
      await Promise.all([

        db
          .select()
          .from(leads)
          .where(
            eq(
              leads.businessId,
              business.businessId,
            ),
          ),


        db
          .select()
          .from(followUps)
          .where(
            eq(
              followUps.businessId,
              business.businessId,
            ),
          ),


        db
          .select()
          .from(aiEmployees)
          .where(
            eq(
              aiEmployees.businessId,
              business.businessId,
            ),
          ),

      ]);


    const now = new Date();


    const overdue =
      followUpsData.filter(
        (item) =>
          item.dueAt < now &&
          item.status !== "completed",
      ).length;


    const alerts = [];


    if (overdue > 0) {

      alerts.push({
        level: "High Priority",
        title:
          `${overdue} overdue follow-ups need attention`,
        description:
          "Kuba recommends reviewing pending customer actions.",
        icon: "🔴",
      });

    }


    if (leadsData.length > 0) {

      alerts.push({
        level: "Sales Opportunity",
        title:
          `${leadsData.length} active sales opportunities`,
        description:
          "Review your pipeline and prioritize important leads.",
        icon: "🟡",
      });

    }


    if (employeesData.length > 0) {

      alerts.push({
        level: "AI Workforce",
        title:
          `${employeesData.length} Kuba employees active`,
        description:
          "Your AI workforce is currently supporting operations.",
        icon: "🟢",
      });

    }


    return NextResponse.json({
      alerts,
    });


  } catch(error) {

    console.error(
      "Command center alerts error",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load alerts",
      },
      {
        status:500,
      },
    );

  }

}
