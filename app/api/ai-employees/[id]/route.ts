import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";

/**
 * Deactivate/reactivate an AI employee. Previously missing entirely (see
 * docs/CURRENT_STATE.md's honest "genuine gap" note) — no code path
 * anywhere wrote aiEmployees.status back to "inactive".
 *
 * Deliberately status-only, never a delete: every runtime chat route
 * already resolves the employee via `eq(aiEmployees.status, "active")`
 * (e.g. app/api/ai/receptionist/route.ts), and every write/action tool
 * already re-checks the employee is active via
 * checkAIEmployeeAuthority()'s own active-status guard — so flipping this
 * one column is sufficient to stop new autonomous execution immediately,
 * with zero changes to the runtime routes themselves. Historical
 * conversations, activities, and settings rows are untouched and remain
 * fully intact; reactivating restores exactly the same row.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user, membership, error } = await requireBusinessMembership();

    if (!user) {
      return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    }
    if (!membership) {
      return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });
    }
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) {
      return NextResponse.json(
        { error: "You do not have permission to manage AI employees." },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body = await request.json();
    const action = typeof body.action === "string" ? body.action : "";

    if (action !== "deactivate" && action !== "reactivate") {
      return NextResponse.json(
        { error: 'action must be "deactivate" or "reactivate".' },
        { status: 400 },
      );
    }

    const existing = (
      await db
        .select({
          id: aiEmployees.id,
          businessId: aiEmployees.businessId,
          type: aiEmployees.type,
          status: aiEmployees.status,
        })
        .from(aiEmployees)
        .where(eq(aiEmployees.id, id))
        .limit(1)
    )[0];

    // Same 404 whether the employee genuinely doesn't exist or belongs to a
    // different business — never reveal cross-tenant existence.
    if (!existing || existing.businessId !== membership.businessId) {
      return NextResponse.json({ error: "Employee not found." }, { status: 404 });
    }

    const nextStatus = action === "deactivate" ? "inactive" : "active";

    if (existing.status === nextStatus) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        employee: { id: existing.id, status: nextStatus },
      });
    }

    await db
      .update(aiEmployees)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(and(eq(aiEmployees.id, id), eq(aiEmployees.businessId, membership.businessId)));

    await createAuditLog({
      businessId: membership.businessId,
      userId: user.id,
      action: action === "deactivate" ? "ai_employee.deactivated" : "ai_employee.reactivated",
      resource: "ai_employee",
      resourceId: id,
      description: action === "deactivate" ? "AI employee deactivated" : "AI employee reactivated",
      metadata: { employeeType: existing.type, previousStatus: existing.status, newStatus: nextStatus },
    });

    return NextResponse.json({ success: true, employee: { id: existing.id, status: nextStatus } });
  } catch (error) {
    console.error("AI employee status change error:", error);
    return NextResponse.json({ error: "Unable to update the AI employee." }, { status: 500 });
  }
}
