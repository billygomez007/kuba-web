import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees, aiEmployeeScopes } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { CUSTOM_TOOL_CATALOG, customToolScope, isCustomToolId } from "@/mastra/agents/custom";

/*
 * Tool-permission management for Custom AI employees. The platform controls
 * the ceiling (CUSTOM_TOOL_CATALOG); this route only ever lets a business
 * choose a SUBSET of it for one of its own Custom employees — it can never
 * grant a tool outside the curated catalog, never targets another
 * business's employee, and never touches a non-"custom" employee (every
 * other type has a fixed, code-defined tool set that isn't user-editable).
 *
 * Grants are stored in aiEmployeeScopes, an existing schema table with no
 * other consumer before this change — no migration required. Revoking a
 * tool sets its row to status "revoked" rather than deleting it, preserving
 * a real audit trail of what was granted and when.
 */

async function loadTenantScopedCustomEmployee(businessId: string, employeeId: string) {
  const rows = await db
    .select({ id: aiEmployees.id, businessId: aiEmployees.businessId, type: aiEmployees.type })
    .from(aiEmployees)
    .where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, businessId)))
    .limit(1);
  return rows[0];
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, membership, error } = await requireBusinessMembership();
    if (!user) return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });

    const { id: employeeId } = await context.params;
    const employee = await loadTenantScopedCustomEmployee(membership.businessId, employeeId);

    if (!employee || employee.type !== "custom") {
      return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    }

    const grantedRows = await db
      .select({ scope: aiEmployeeScopes.scope })
      .from(aiEmployeeScopes)
      .where(
        and(
          eq(aiEmployeeScopes.businessId, membership.businessId),
          eq(aiEmployeeScopes.aiEmployeeId, employeeId),
          eq(aiEmployeeScopes.effect, "allow"),
          eq(aiEmployeeScopes.status, "active"),
        ),
      );

    const grantedToolIds = new Set(
      grantedRows.map((row) => row.scope.replace(/^tool:/, "")).filter((id) => isCustomToolId(id)),
    );

    const catalog = Object.entries(CUSTOM_TOOL_CATALOG).map(([toolId, entry]) => ({
      toolId,
      label: entry.label,
      category: entry.category,
      riskLevel: entry.riskLevel,
      description: entry.description,
      granted: grantedToolIds.has(toolId),
    }));

    return NextResponse.json({ success: true, catalog });
  } catch (error) {
    console.error("Load custom employee tools error:", error);
    return NextResponse.json({ error: "Unable to load tool permissions." }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { user, membership, error } = await requireBusinessMembership();
    if (!user) return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });

    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.WORKFORCE_MANAGE)) {
      return NextResponse.json({ error: "You do not have permission to manage AI employee tools." }, { status: 403 });
    }

    const { id: employeeId } = await context.params;
    const employee = await loadTenantScopedCustomEmployee(membership.businessId, employeeId);

    if (!employee || employee.type !== "custom") {
      return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    }

    const body = await request.json();
    const requestedToolIds: string[] = Array.isArray(body.toolIds) ? body.toolIds : [];

    // Never trust a client-supplied tool ID outside the curated catalog —
    // this is the platform's ceiling, not a business-editable list.
    const desired = new Set(requestedToolIds.filter((toolId) => isCustomToolId(toolId)));

    const existingRows = await db
      .select({ id: aiEmployeeScopes.id, scope: aiEmployeeScopes.scope, status: aiEmployeeScopes.status })
      .from(aiEmployeeScopes)
      .where(
        and(
          eq(aiEmployeeScopes.businessId, membership.businessId),
          eq(aiEmployeeScopes.aiEmployeeId, employeeId),
          eq(aiEmployeeScopes.effect, "allow"),
        ),
      );

    const existingByScope = new Map(existingRows.map((row) => [row.scope, row]));
    const now = new Date();
    const changes: { toolId: string; action: "granted" | "revoked" }[] = [];

    for (const toolId of Object.keys(CUSTOM_TOOL_CATALOG)) {
      const scope = customToolScope(toolId);
      const existing = existingByScope.get(scope);
      const shouldBeActive = desired.has(toolId);

      if (shouldBeActive && (!existing || existing.status !== "active")) {
        if (existing) {
          await db
            .update(aiEmployeeScopes)
            .set({ status: "active", updatedAt: now })
            .where(eq(aiEmployeeScopes.id, existing.id));
        } else {
          await db.insert(aiEmployeeScopes).values({
            id: crypto.randomUUID(),
            businessId: membership.businessId,
            aiEmployeeId: employeeId,
            scope,
            effect: "allow",
            status: "active",
            grantedByUserId: user.id,
            createdAt: now,
            updatedAt: now,
          });
        }
        changes.push({ toolId, action: "granted" });
      } else if (!shouldBeActive && existing && existing.status === "active") {
        await db
          .update(aiEmployeeScopes)
          .set({ status: "revoked", updatedAt: now })
          .where(eq(aiEmployeeScopes.id, existing.id));
        changes.push({ toolId, action: "revoked" });
      }
    }

    if (changes.length > 0) {
      await createAuditLog({
        businessId: membership.businessId,
        userId: user.id,
        action: "ai_employee.tools_updated",
        resource: "ai_employee",
        resourceId: employeeId,
        description: `Updated tool permissions for a Custom AI employee (${changes.length} change${changes.length === 1 ? "" : "s"}).`,
        metadata: { changes },
      });
    }

    return NextResponse.json({ success: true, grantedToolIds: [...desired] });
  } catch (error) {
    console.error("Update custom employee tools error:", error);
    return NextResponse.json({ error: "Unable to update tool permissions." }, { status: 500 });
  }
}
