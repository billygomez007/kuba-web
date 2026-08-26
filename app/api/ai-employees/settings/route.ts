import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  aiEmployees,
  aiEmployeeSettings,
  businessUsers,
} from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";

import {
  hasPermission,
  PERMISSIONS,
} from "@/lib/auth/permissions";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

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
            "You do not have permission to manage AI employee settings.",
        },
        { status: 403 },
      );
    }

    if (!hasCapability(await getBusinessEntitlements(membership.businessId), "ai_workforce.core")) {
      return NextResponse.json({ error: "AI Workforce requires a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "starter" }, { status: 403 });
    }

    const formData =
      await request.formData();

    const employeeId =
      String(
        formData.get(
          "employeeId",
        ) || "",
      ).trim();

    if (!employeeId) {
      return NextResponse.json(
        {
          error:
            "Employee ID is required.",
        },
        { status: 400 },
      );
    }

    const employeeResult =
      await db
        .select({
          id: aiEmployees.id,
          supervisorUserId:
            aiEmployees.supervisorUserId,
        })
        .from(aiEmployees)
        .where(
          and(
            eq(
              aiEmployees.id,
              employeeId,
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

    const roleInstructions =
      String(
        formData.get(
          "roleInstructions",
        ) || "",
      ).trim();

    const goals =
      String(
        formData.get("goals") || "",
      ).trim();

    const responsibilities =
      String(
        formData.get(
          "responsibilities",
        ) || "",
      ).trim();

    const personality =
      String(
        formData.get(
          "personality",
        ) || "",
      ).trim();

    const communicationStyle =
      String(
        formData.get(
          "communicationStyle",
        ) || "",
      ).trim();

    const informationToCollect =
      String(
        formData.get(
          "informationToCollect",
        ) || "",
      ).trim();

    const escalationRules =
      String(
        formData.get(
          "escalationRules",
        ) || "",
      ).trim();

    const handoffRules =
      String(
        formData.get(
          "handoffRules",
        ) || "",
      ).trim();

    const workingHours =
      String(
        formData.get(
          "workingHours",
        ) || "",
      ).trim();

    const supervisionMode =
      String(
        formData.get(
          "supervisionMode",
        ) || "owner_supervised",
      ).trim();

    const supervisorUserId =
      String(
        formData.get(
          "supervisorUserId",
        ) || "",
      ).trim();

    if (
      supervisorUserId &&
      supervisorUserId !==
        user.id
    ) {
      const supervisor =
        await db
          .select({
            id:
              businessUsers.userId,
          })
          .from(businessUsers)
          .where(
            and(
              eq(
                businessUsers.userId,
                supervisorUserId,
              ),
              eq(
                businessUsers.businessId,
                membership.businessId,
              ),
            ),
          )
          .limit(1);

      if (!supervisor[0]) {
        return NextResponse.json(
          {
            error:
              "Supervisor must be a member of the same business.",
          },
          { status: 400 },
        );
      }
    }

    const existing =
      await db
        .select({
          id:
            aiEmployeeSettings.id,
        })
        .from(aiEmployeeSettings)
        .innerJoin(
          aiEmployees,
          eq(
            aiEmployeeSettings.employeeId,
            aiEmployees.id,
          ),
        )
        .where(
          and(
            eq(
              aiEmployeeSettings.employeeId,
              employeeId,
            ),
            eq(
              aiEmployees.businessId,
              membership.businessId,
            ),
          ),
        )
        .limit(1);

    const now =
      new Date();

    await db
      .update(aiEmployees)
      .set({
        supervisionMode,
        supervisorUserId:
          supervisorUserId ||
          null,
        updatedAt: now,
      })
      .where(
        and(
          eq(
            aiEmployees.id,
            employeeId,
          ),
          eq(
            aiEmployees.businessId,
            membership.businessId,
          ),
        ),
      );

    if (existing.length > 0) {
      await db
        .update(aiEmployeeSettings)
        .set({
          roleInstructions:
            roleInstructions ||
            null,

          goals:
            goals || null,

          responsibilities:
            responsibilities ||
            null,

          personality:
            personality ||
            null,

          communicationStyle:
            communicationStyle ||
            null,

          informationToCollect:
            informationToCollect ||
            null,

          escalationRules:
            escalationRules ||
            null,

          handoffRules:
            handoffRules ||
            null,

          workingHours:
            workingHours ||
            null,

          updatedAt: now,
        })
        .where(
          eq(
            aiEmployeeSettings.id,
            existing[0].id,
          ),
        );
    } else {
      await db
        .insert(
          aiEmployeeSettings,
        )
        .values({
          id:
            crypto.randomUUID(),

          employeeId,

          roleInstructions:
            roleInstructions ||
            null,

          goals:
            goals || null,

          responsibilities:
            responsibilities ||
            null,

          personality:
            personality ||
            null,

          communicationStyle:
            communicationStyle ||
            null,

          informationToCollect:
            informationToCollect ||
            null,

          escalationRules:
            escalationRules ||
            null,

          handoffRules:
            handoffRules ||
            null,

          workingHours:
            workingHours ||
            null,

          createdAt: now,

          updatedAt: now,
        });
    }

    return NextResponse.redirect(
      new URL(
        `/dashboard/employees/${employeeId}/settings`,
        request.url,
      ),
    );
  } catch (error) {
    console.error(
      "AI employee settings update error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to update AI employee settings.",
      },
      { status: 500 },
    );
  }
}
