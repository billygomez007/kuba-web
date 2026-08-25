import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiEmployees,
  businesses,
} from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import {
  employeeLimitMessage,
  getPlanDefinition,
} from "@/lib/billing/entitlements";

export async function POST(
  request: Request,
) {
  let activationStage =
    "authorize";

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
        PERMISSIONS.WORKFORCE_MANAGE,
      )
    ) {
      return NextResponse.json(
        {
          error:
            "You do not have permission to manage AI employees.",
        },
        { status: 403 },
      );
    }

    activationStage =
      "load_plan";
    const businessResult = await db
      .select({
        plan: businesses.plan,
      })
      .from(businesses)
      .where(
        eq(
          businesses.id,
          membership.businessId,
        ),
      )
      .limit(1);
    const business = businessResult[0];

    if (!business) {
      return NextResponse.json(
        {
          error:
            "Business access denied.",
        },
        { status: 403 },
      );
    }

    const plan =
      getPlanDefinition(business.plan);
    if (plan.employeeLimit !== null) {
      activationStage =
        "check_employee_limit";
      const activeEmployees = await db.select({ total: count() }).from(aiEmployees).where(and(eq(aiEmployees.businessId, membership.businessId), eq(aiEmployees.status, "active")));
      if (Number(activeEmployees[0]?.total || 0) >= plan.employeeLimit) {
        return NextResponse.json({ error: employeeLimitMessage(plan), upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
      }
    }

    activationStage =
      "parse_request";
    const body =
      await request.json();

    const type =
      String(
        body.type || "",
      ).trim();

    const name =
      String(
        body.name || "",
      ).trim();

    const description =
      String(
        body.description || "",
      ).trim();

    const templateId =
      typeof body.templateId ===
      "string"
        ? body.templateId.trim() ||
          null
        : null;

    if (!type || !name) {
      return NextResponse.json(
        {
          error:
            "Employee name and type are required.",
        },
        { status: 400 },
      );
    }

    if (plan.id === "starter" && !["receptionist", "appointment", "customer-support"].includes(type)) {
      return NextResponse.json({ error: `${type} AI requires Growth or higher.`, upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
    }

    activationStage =
      "check_existing_employee";
    const existingEmployee =
      await db
        .select({
          id:
            aiEmployees.id,
          name:
            aiEmployees.name,
          status:
            aiEmployees.status,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(
              aiEmployees.businessId,
              membership.businessId,
            ),
            eq(
              aiEmployees.type,
              type,
            ),
          ),
        )
        .limit(1);

    const existing =
      existingEmployee[0];

    if (existing) {
      if (
        existing.status !==
        "active"
      ) {
        activationStage =
          "reactivate_employee";
        await db
          .update(aiEmployees)
          .set({
            name,
            description:
              description ||
              null,
            templateId,
            status:
              "active",
            supervisorUserId:
              user.id,
            updatedAt:
              new Date(),
          })
          .where(
            and(
              eq(
                aiEmployees.id,
                existing.id,
              ),
              eq(
                aiEmployees.businessId,
                membership.businessId,
              ),
            ),
          );
      }

      return NextResponse.json(
        {
          success:
            true,
          activated:
            existing.status !==
            "active",
          employee: {
            id:
              existing.id,
            name:
              existing.status ===
              "active"
                ? existing.name
                : name,
            type,
            status:
              "active",
          },
        },
        { status: 200 },
      );
    }

    const now =
      new Date();

    const employeeId =
      crypto.randomUUID();

    activationStage =
      "insert_employee";
    await db
      .insert(aiEmployees)
      .values({
        id: employeeId,

        businessId:
          membership.businessId,

        branchId:
          membership.branchId ||
          null,

        templateId,

        name,

        type,

        description:
          description ||
          null,

        supervisionMode:
          "owner_supervised",

        supervisorUserId:
          user.id,

        status:
          "active",

        mastraAgentId:
          null,

        createdAt: now,

        updatedAt: now,
      });

    return NextResponse.json(
      {
        success: true,

        employee: {
          id:
            employeeId,

          name,

          type,

          status:
            "active",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "AI employee creation error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to activate the AI employee.",
        code:
          "AI_EMPLOYEE_ACTIVATION_FAILED",
        stage:
          activationStage,
      },
      { status: 500 },
    );
  }
}
