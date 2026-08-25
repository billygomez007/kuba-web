import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, count, eq, lt, sql } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";

import {
  aiEmployees,
  tasks,
  aiEmployeeActivities,
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

    const employees =
      await db
        .select()
        .from(aiEmployees)
        .where(
          eq(
            aiEmployees.businessId,
            business.businessId,
          ),
        );

    const performance =
      await Promise.all(
        employees.map(
          async (employee) => {

            const [
              totalTasks,
              completedTasks,
              pendingTasks,
              overdueTasks,
              activities,
            ] = await Promise.all([

              db
                .select({
                  count: count(),
                })
                .from(tasks)
                .where(
                  and(
                    eq(
                      tasks.businessId,
                      business.businessId,
                    ),
                    eq(
                      tasks.assignedEmployeeId,
                      employee.id,
                    ),
                  ),
                ),

              db
                .select({
                  count: count(),
                })
                .from(tasks)
                .where(
                  and(
                    eq(
                      tasks.businessId,
                      business.businessId,
                    ),
                    eq(
                      tasks.assignedEmployeeId,
                      employee.id,
                    ),
                    eq(
                      tasks.status,
                      "completed",
                    ),
                  ),
                ),

              db
                .select({
                  count: count(),
                })
                .from(tasks)
                .where(
                  and(
                    eq(
                      tasks.businessId,
                      business.businessId,
                    ),
                    eq(
                      tasks.assignedEmployeeId,
                      employee.id,
                    ),
                    eq(
                      tasks.status,
                      "pending",
                    ),
                  ),
                ),

              db
                .select({
                  count: count(),
                })
                .from(tasks)
                .where(
                  and(
                    eq(
                      tasks.businessId,
                      business.businessId,
                    ),
                    eq(
                      tasks.assignedEmployeeId,
                      employee.id,
                    ),
                    sql`LOWER(${tasks.status}) != 'completed'`,
                    lt(
                      tasks.dueAt,
                      new Date(),
                    ),
                  ),
                ),

              db
                .select({
                  count: count(),
                })
                .from(aiEmployeeActivities)
                .where(
                  and(
                    eq(
                      aiEmployeeActivities.businessId,
                      business.businessId,
                    ),
                    eq(
                      aiEmployeeActivities.employeeId,
                      employee.id,
                    ),
                  ),
                ),

            ]);

            const total =
              Number(
                totalTasks[0]?.count || 0,
              );

            const completed =
              Number(
                completedTasks[0]?.count || 0,
              );

            const pending =
              Number(
                pendingTasks[0]?.count || 0,
              );

            const overdue =
              Number(
                overdueTasks[0]?.count || 0,
              );

            const activityCount =
              Number(
                activities[0]?.count || 0,
              );

            const completionRate =
              total > 0
                ? Number(
                    (
                      (completed /
                        total) *
                      100
                    ).toFixed(1),
                  )
                : 0;

            return {
              id: employee.id,
              name:
                employee.name,
              type:
                employee.type,
              status:
                employee.status,

              tasks: {
                total,
                completed,
                pending,
                overdue,
              },

              activities:
                activityCount,

              completionRate,
            };
          },
        ),
      );

    performance.sort(
      (a, b) =>
        b.completionRate -
        a.completionRate,
    );

    return NextResponse.json({
      employees: performance,
      generatedAt:
        new Date().toISOString(),
    });

  } catch (error) {

    console.error(
      "Analytics employee performance error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load employee analytics.",
      },
      {
        status: 500,
      },
    );
  }
}
