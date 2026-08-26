import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiEmployees,
} from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getBusinessPlan, employeeLimitMessage, getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

export async function POST(
  request: Request,
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

    if (!hasCapability(await getBusinessEntitlements(membership.businessId), "ai_workforce.core")) {
      return NextResponse.json({ error: "AI Workforce requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "starter" }, { status: 403 });
    }

    const plan = await getBusinessPlan(membership.businessId);
    if (plan.employeeLimit !== null) {
      const activeEmployees = await db.select({ total: count() }).from(aiEmployees).where(and(eq(aiEmployees.businessId, membership.businessId), eq(aiEmployees.status, "active")));
      if (Number(activeEmployees[0]?.total || 0) >= plan.employeeLimit) {
        return NextResponse.json({ error: employeeLimitMessage(plan), upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
      }
    }

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

    const existingEmployee =
      await db
        .select({
          id:
            aiEmployees.id,
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

    if (
      existingEmployee.length >
      0
    ) {
      return NextResponse.json(
        {
          error:
            "This AI employee is already activated.",
        },
        { status: 409 },
      );
    }

    const now =
      new Date();

    const employeeId =
      crypto.randomUUID();

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
      },
      { status: 500 },
    );
  }
}
