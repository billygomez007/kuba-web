import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, desc, eq } from "drizzle-orm";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { getCurrentMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { rejectBusinessOverride } from "@/lib/operations/policy";
import { getBusinessEntitlements, hasCapability } from "@/lib/billing/entitlements";

import {
  automations,
} from "@/db/schema";


async function getBusinessId() {
  const session =
    await auth.api.getSession({
      headers: await headers(),
    });

  if (!session?.user) {
    return {
      session: null,
      membership: null,
      businessId: null,
    };
  }

  const membership = await getCurrentMembership();

  return {
    session,
    membership,
    businessId:
      membership?.businessId || null,
  };
}


function validateAutomation(body: Record<string, unknown>) {
  const name =
    String(body.name || "").trim();

  const description =
    body.description
      ? String(body.description).trim()
      : null;

  const trigger =
    String(body.trigger || "").trim();

  const conditions =
    body.conditions ?? [];

  const actions =
    body.actions ?? [];

  const status =
    body.status === "paused"
      ? "paused"
      : "active";

  if (!name) {
    throw new Error(
      "Automation name is required.",
    );
  }

  if (!trigger) {
    throw new Error(
      "Automation trigger is required.",
    );
  }

  if (!Array.isArray(conditions)) {
    throw new Error(
      "Automation conditions must be an array.",
    );
  }

  if (
    !Array.isArray(actions) ||
    actions.length === 0
  ) {
    throw new Error(
      "Automation must contain at least one action.",
    );
  }

  return {
    name,
    description,
    trigger,
    conditions,
    actions,
    status,
  };
}

async function automationFeatureGuard(businessId: string) {
  const entitlements = await getBusinessEntitlements(businessId);
  return hasCapability(entitlements, "business_ops.automations")
    ? null
    : NextResponse.json({ error: "Automations require a higher plan.", code: "FEATURE_NOT_ENTITLED", upgradeRequired: true, requiredPlan: "growth" }, { status: 403 });
}


export async function GET() {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_VIEW)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const featureError = await automationFeatureGuard(businessId);
    if (featureError) return featureError;

    const results =
      await db
        .select()
        .from(automations)
        .where(
          eq(
            automations.businessId,
            businessId,
          ),
        )
        .orderBy(
          desc(
            automations.createdAt,
          ),
        );

    return NextResponse.json({
      automations: results,
    });
  } catch (error) {
    console.error(
      "Automation GET error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to load automations.",
      },
      { status: 500 },
    );
  }
}


export async function POST(
  request: Request,
) {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    const featureError = await automationFeatureGuard(businessId);
    if (featureError) return featureError;

    const body =
      await request.json();
    if (rejectBusinessOverride(body, businessId)) return NextResponse.json({ error: "Business context override is not allowed." }, { status: 400 });

    const validated =
      validateAutomation(body);

    const now =
      new Date();

    const automation = {
      id:
        crypto.randomUUID(),

      businessId,

      name:
        validated.name,

      description:
        validated.description,

      trigger:
        validated.trigger,

      conditions:
        JSON.stringify(
          validated.conditions,
        ),

      actions:
        JSON.stringify(
          validated.actions,
        ),

      status:
        validated.status,

      createdAt:
        now,

      updatedAt:
        now,
    };

    await db
      .insert(automations)
      .values(automation);
    await createAuditLog({ businessId, userId: session.user.id, action: "automation.created", resource: "automation", resourceId: automation.id, description: automation.name });

    return NextResponse.json(
      {
        success: true,
        automation,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error(
      "Automation POST error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create automation.",
      },
      { status: 400 },
    );
  }
}


export async function PATCH(
  request: Request,
) {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }
    const featureError = await automationFeatureGuard(businessId);
    if (featureError) return featureError;
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const body =
      await request.json();
    if (rejectBusinessOverride(body, businessId)) return NextResponse.json({ error: "Business context override is not allowed." }, { status: 400 });

    const id =
      String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Automation ID is required.",
        },
        { status: 400 },
      );
    }

    const validated =
      validateAutomation(body);

    const result =
      await db
        .update(automations)
        .set({
          name:
            validated.name,

          description:
            validated.description,

          trigger:
            validated.trigger,

          conditions:
            JSON.stringify(
              validated.conditions,
            ),

          actions:
            JSON.stringify(
              validated.actions,
            ),

          status:
            validated.status,

          updatedAt:
            new Date(),
        })
        .where(
          and(
            eq(
              automations.id,
              id,
            ),
            eq(
              automations.businessId,
              businessId,
            ),
          ),
        )
        .returning();

    if (!result[0]) {
      return NextResponse.json(
        {
          error:
            "Automation not found.",
        },
        { status: 404 },
      );
    }
    await createAuditLog({ businessId, userId: session.user.id, action: validated.status === "active" ? "automation.enabled" : "automation.disabled", resource: "automation", resourceId: id, description: validated.name });

    return NextResponse.json({
      success: true,
      automation:
        result[0],
    });
  } catch (error) {
    console.error(
      "Automation PATCH error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to update automation.",
      },
      { status: 400 },
    );
  }
}


export async function DELETE(
  request: Request,
) {
  try {
    const {
      session,
      membership,
      businessId,
    } = await getBusinessId();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    if (!businessId) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }
    const featureError = await automationFeatureGuard(businessId);
    if (featureError) return featureError;
    if (!membership || !hasPermission(membership.role, membership.permissions, PERMISSIONS.AUTOMATIONS_MANAGE)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });

    const body =
      await request.json();
    if (rejectBusinessOverride(body, businessId)) return NextResponse.json({ error: "Business context override is not allowed." }, { status: 400 });

    const id =
      String(body.id || "").trim();

    if (!id) {
      return NextResponse.json(
        {
          error:
            "Automation ID is required.",
        },
        { status: 400 },
      );
    }

    const result =
      await db
        .delete(automations)
        .where(
          and(
            eq(
              automations.id,
              id,
            ),
            eq(
              automations.businessId,
              businessId,
            ),
          ),
        )
        .returning({
          id: automations.id,
        });

    if (!result[0]) {
      return NextResponse.json(
        {
          error:
            "Automation not found.",
        },
        { status: 404 },
      );
    }
    await createAuditLog({ businessId, userId: session.user.id, action: "automation.deleted", resource: "automation", resourceId: id });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "Automation DELETE error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Unable to delete automation.",
      },
      { status: 500 },
    );
  }
}
