import { and, eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiEmployees,
  conversations,
  handoffs,
  aiEmployeeActivities,
  users,
} from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const {
      user,
      membership,
      error,
    } =
      await requireBusinessMembership();

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
        PERMISSIONS.WORKFORCE_VIEW,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to view AI workforce data.",
        },
        { status: 403 },
      );
    }

    const { id } =
      await context.params;

    const employeeResult =
      await db
        .select({
          employee: aiEmployees,
          supervisorName:
            users.name,
        })
        .from(aiEmployees)
        .leftJoin(
          users,
          eq(
            users.id,
            aiEmployees.supervisorUserId,
          ),
        )
        .where(
          and(
            eq(
              aiEmployees.id,
              id,
            ),
            eq(
              aiEmployees.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    const employee =
      employeeResult[0];

    if (!employee) {
      return NextResponse.json(
        {
          error:
            "AI employee not found.",
        },
        { status: 404 },
      );
    }

    const conversationCount =
      await db
        .select({
          total: count(),
        })
        .from(conversations)
        .where(
          and(
            eq(
              conversations.assignedEmployeeId,
              id,
            ),
            eq(
              conversations.businessId,
              membership.businessId,
            ),
          ),
        );

    const handoffCount =
      await db
        .select({
          total: count(),
        })
        .from(handoffs)
        .where(
          and(
            eq(
              handoffs.fromEmployeeId,
              id,
            ),
            eq(
              handoffs.businessId,
              membership.businessId,
            ),
          ),
        );

    const activities =
      await db
        .select()
        .from(aiEmployeeActivities)
        .where(
          and(
            eq(
              aiEmployeeActivities.employeeId,
              id,
            ),
            eq(
              aiEmployeeActivities.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(10);

    return NextResponse.json({
      employee: {
        id:
          employee.employee.id,

        name:
          employee.employee.name,

        type:
          employee.employee.type,

        status:
          employee.employee.status,

        supervisionMode:
          employee.employee.supervisionMode,

        supervisor:
          employee.supervisorName ||
          null,
      },

      metrics: {
        conversations:
          conversationCount[0]
            ?.total || 0,

        handoffs:
          handoffCount[0]
            ?.total || 0,
      },

      activities,
    });
  } catch (error) {
    console.error(
      "Employee dashboard error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load employee dashboard.",
      },
      { status: 500 },
    );
  }
}
