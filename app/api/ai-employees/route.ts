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
import {
  getBusinessEntitlements,
} from "@/lib/billing/entitlements";
import {
  canActivateEmployee,
} from "@/lib/billing/ai-workforce-policy";

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

    /*
     * Server-side entitlement policy is authoritative here — the client's
     * `type` is only ever used to look up what THIS business is entitled to
     * do, never trusted as authorization by itself. canActivateEmployee
     * checks both independent dimensions (employee count AND employee type)
     * using the same subscription/trial-aware entitlements resolution the
     * rest of the app relies on, and is the same function the runtime chat
     * routes use — so activation and runtime entitlement can never disagree.
     */
    activationStage =
      "check_entitlement";
    const entitlements =
      await getBusinessEntitlements(membership.businessId);
    const activeEmployees = await db
      .select({ total: count() })
      .from(aiEmployees)
      .where(
        and(
          eq(aiEmployees.businessId, membership.businessId),
          eq(aiEmployees.status, "active"),
        ),
      );
    const activationDecision = canActivateEmployee(
      entitlements,
      type,
      Number(activeEmployees[0]?.total || 0),
    );

    if (!activationDecision.allowed) {
      return NextResponse.json(
        {
          error: activationDecision.message,
          code: activationDecision.code,
          // A genuine plan-upgrade path (a specific requiredPlan, or more
          // workforce capacity from EMPLOYEE_LIMIT_REACHED) sets this.
          // EMPLOYEE_NOT_AVAILABLE and ENTERPRISE_CONFIGURATION_REQUIRED
          // are never solved by upgrading, so both must resolve to false.
          upgradeRequired: Boolean(activationDecision.requiredPlan) || activationDecision.code === "EMPLOYEE_LIMIT_REACHED",
          ...(activationDecision.requiredPlan ? { requiredPlan: activationDecision.requiredPlan } : {}),
        },
        { status: 403 },
      );
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
