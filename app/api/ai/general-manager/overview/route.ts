import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businesses,
  businessUsers,
  aiEmployees,
  leads,
  followUps,
  aiEmployeeActivities,
} from "@/db/schema";

export async function GET() {
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

    const businessResult = await db
      .select({
        business: businesses,
      })
      .from(businessUsers)
      .innerJoin(
        businesses,
        eq(businessUsers.businessId, businesses.id),
      )
      .where(eq(businessUsers.userId, session.user.id))
      .limit(1);

    const business = businessResult[0]?.business;

    if (!business) {
      return NextResponse.json(
        { error: "No business is associated with your account." },
        { status: 404 },
      );
    }

    const [
      employees,
      leadsData,
      followUpsData,
      activities,
    ] = await Promise.all([
      db
        .select()
        .from(aiEmployees)
        .where(
          and(
            eq(aiEmployees.businessId, business.id),
            eq(aiEmployees.status, "active"),
          ),
        ),

      db
        .select()
        .from(leads)
        .where(eq(leads.businessId, business.id)),

      db
        .select()
        .from(followUps)
        .where(eq(followUps.businessId, business.id)),

      db
        .select()
        .from(aiEmployeeActivities)
        .where(eq(aiEmployeeActivities.businessId, business.id))
        .limit(20),
    ]);

    const now = new Date();

    const pendingFollowUps = followUpsData.filter(
      (item) => item.status === "pending",
    );

    const overdueFollowUps = pendingFollowUps.filter(
      (item) => new Date(item.dueAt) < now,
    );

    const completedFollowUps = followUpsData.filter(
      (item) => item.status === "completed",
    );

    const executiveEmployee = employees.find(
      (employee) => employee.type === "general-manager",
    );

    const workforce = employees
      .filter(
        (employee) => employee.type !== "general-manager",
      )
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        type: employee.type,
        status: employee.status,
        description: employee.description,
      }));

    const priorities: {
      type: string;
      title: string;
      description: string;
    }[] = [];

    if (overdueFollowUps.length > 0) {
      priorities.push({
        type: "attention",
        title: "Overdue follow-ups need attention",
        description: `${overdueFollowUps.length} follow-up${
          overdueFollowUps.length === 1 ? "" : "s"
        } are overdue.`,
      });
    }

    if (pendingFollowUps.length > 0) {
      priorities.push({
        type: "follow-up",
        title: "Follow-ups are pending",
        description: `${pendingFollowUps.length} follow-up${
          pendingFollowUps.length === 1 ? "" : "s"
        } currently require action.`,
      });
    }

    if (leadsData.length > 0) {
      priorities.push({
        type: "revenue",
        title: "Sales opportunities are active",
        description: `${leadsData.length} lead${
          leadsData.length === 1 ? "" : "s"
        } are currently recorded in the business.`,
      });
    }

    if (workforce.length === 0) {
      priorities.push({
        type: "workforce",
        title: "Build your AI workforce",
        description:
          "No specialized AI employees are currently active.",
      });
    }

    return NextResponse.json({
      success: true,

      business: {
        id: business.id,
        name: business.name,
        industry: business.industry,
        country: business.country,
        status: business.status,
      },

      executive: executiveEmployee
        ? {
            id: executiveEmployee.id,
            name: executiveEmployee.name,
            status: executiveEmployee.status,
          }
        : null,

      metrics: {
        activeEmployees: employees.length,
        specializedEmployees: workforce.length,
        totalLeads: leadsData.length,
        pendingFollowUps: pendingFollowUps.length,
        overdueFollowUps: overdueFollowUps.length,
        completedFollowUps: completedFollowUps.length,
      },

      workforce,

      priorities,

      recentActivities: activities
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        )
        .slice(0, 8)
        .map((activity) => ({
          id: activity.id,
          employeeId: activity.employeeId,
          type: activity.type,
          title: activity.title,
          description: activity.description,
          status: activity.status,
          createdAt: activity.createdAt,
        })),
    });
  } catch (error) {
    console.error(
      "General Manager overview error:",
      error,
    );

    return NextResponse.json(
      {
        error: "Unable to load executive overview.",
      },
      { status: 500 },
    );
  }
}
