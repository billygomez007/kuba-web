import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  aiEmployees,
  leads,
  followUps,
  customers,
  conversations,
  tasks,
  actionApprovals,
  aiEmployeeActivities,
} from "@/db/schema";

import { and, desc, eq, gte } from "drizzle-orm";


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

    const business = await getCurrentMembership();

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [
      employeeData,
      leadData,
      followUpData,
      customerData,
      conversationData,
      todayCompletedTasks,
      pendingApprovalData,
      activityData,
    ] = await Promise.all([
      db
        .select()
        .from(aiEmployees)
        .where(
          eq(
            aiEmployees.businessId,
            business.businessId,
          ),
        ),

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
        .from(customers)
        .where(
          eq(
            customers.businessId,
            business.businessId,
          ),
        ),

      db
        .select()
        .from(conversations)
        .where(
          eq(
            conversations.businessId,
            business.businessId,
          ),
        ),

      db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            eq(tasks.businessId, business.businessId),
            eq(tasks.status, "completed"),
            gte(tasks.completedAt, startOfDay),
          ),
        ),

      db
        .select({ id: actionApprovals.id })
        .from(actionApprovals)
        .where(
          and(
            eq(actionApprovals.businessId, business.businessId),
            eq(actionApprovals.status, "pending"),
          ),
        ),

      db
        .select({
          id: aiEmployeeActivities.id,
          employeeId: aiEmployeeActivities.employeeId,
          type: aiEmployeeActivities.type,
          title: aiEmployeeActivities.title,
          description: aiEmployeeActivities.description,
          status: aiEmployeeActivities.status,
          createdAt: aiEmployeeActivities.createdAt,
        })
        .from(aiEmployeeActivities)
        .where(
          eq(
            aiEmployeeActivities.businessId,
            business.businessId,
          ),
        )
        .orderBy(desc(aiEmployeeActivities.createdAt))
        .limit(8),
    ]);

    const pipeline = {
      new: leadData.filter(
        (lead) => lead.stage === "new",
      ).length,

      contacted: leadData.filter(
        (lead) => lead.stage === "contacted",
      ).length,

      qualified: leadData.filter(
        (lead) => lead.stage === "qualified",
      ).length,

      converted: leadData.filter(
        (lead) => lead.stage === "converted",
      ).length,
    };


    const followUpSummary = {
      total: followUpData.length,

      overdue: followUpData.filter(
        (item) =>
          item.dueAt < now &&
          item.status !== "completed",
      ).length,

      assignedToKuba: followUpData.filter(
        (item) =>
          item.assignedEmployeeId !== null,
      ).length,

      pending: followUpData.filter(
        (item) =>
          item.status === "pending",
      ).length,
    };


    return NextResponse.json({
      employees: employeeData.length,

      salesPipeline: {
        total: leadData.length,
        stages: pipeline,
      },

      followUps: followUpSummary,

      customers: customerData.length,

      conversations: conversationData.length,

      workforce: {
        totalEmployees: employeeData.length,
        activeEmployees: employeeData.filter(
          (employee) => employee.status === "active",
        ).length,
        conversationsToday: conversationData.filter(
          (conversation) => conversation.updatedAt >= startOfDay,
        ).length,
        tasksCompletedToday: todayCompletedTasks.length,
        pendingApprovals: pendingApprovalData.length,
        employees: employeeData.map((employee) => ({
          id: employee.id,
          name: employee.name,
          type: employee.type,
          status: employee.status,
        })),
        activities: activityData,
      },
    });

  } catch (error) {

    console.error(
      "Command center overview error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : JSON.stringify(error),
      },
      {
        status:500,
      },
    );

  }
}
