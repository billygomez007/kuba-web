import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessUsers,
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


    const business = membership[0];


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
