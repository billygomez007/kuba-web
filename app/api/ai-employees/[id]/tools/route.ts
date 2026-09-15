import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { aiEmployees, aiEmployeeScopes } from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { createAuditLog } from "@/lib/auth/audit";
import { CUSTOM_TOOL_CATALOG, customToolScope, isCustomToolId } from "@/mastra/agents/custom";
import { customChannelScope, REAL_CUSTOMER_CHANNELS, type ChannelName } from "@/lib/communications/channel-policy";

/*
 * Tool AND channel permission management for Custom AI employees. The
 * platform controls the ceiling (CUSTOM_TOOL_CATALOG for tools,
 * REAL_CUSTOMER_CHANNELS for channels); this route only ever lets a
 * business choose a SUBSET of each for one of its own Custom employees — it
 * can never grant a tool/channel outside the curated lists, never targets
 * another business's employee, and never touches a non-"custom" employee
 * (every other type has a fixed, code-defined tool set and channel policy
 * that isn't user-editable — see lib/communications/channel-policy.ts).
 *
 * Grants are stored in aiEmployeeScopes, an existing schema table with no
 * other consumer before the Custom-employee work — no migration required.
 * Revoking a grant sets its row to status "revoked" rather than deleting
 * it, preserving a real audit trail of what was granted and when. A Custom
 * employee is internal-only (no channel eligible) until an owner/admin
 * explicitly grants a channel here.
 */

const CHANNEL_LABELS: Record<ChannelName, string> = {
  website_chat: "Website Chat",
  whatsapp: "WhatsApp",
  email: "Email",
  voice: "Voice",
  dashboard: "Dashboard",
};

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

    const grantedScopes = new Set(grantedRows.map((row) => row.scope));

    const catalog = Object.entries(CUSTOM_TOOL_CATALOG).map(([toolId, entry]) => ({
      toolId,
      label: entry.label,
      category: entry.category,
      riskLevel: entry.riskLevel,
      description: entry.description,
      granted: grantedScopes.has(customToolScope(toolId)),
    }));

    const channels = REAL_CUSTOMER_CHANNELS.map((channel) => ({
      channel,
      label: CHANNEL_LABELS[channel],
      granted: grantedScopes.has(customChannelScope(channel)),
    }));

    return NextResponse.json({ success: true, catalog, channels });
  } catch (error) {
    console.error("Load custom employee tools error:", error);
    return NextResponse.json({ error: "Unable to load tool permissions." }, { status: 500 });
  }
}

/**
 * Reconciles the active `allow` scope rows for one employee against a
 * desired set of scope strings, restricted to the given universe of
 * possible scopes (the platform-controlled ceiling). Returns the changes
 * made, for audit logging.
 */
async function reconcileScopes({
  businessId,
  employeeId,
  userId,
  possibleScopes,
  desiredScopes,
}: {
  businessId: string;
  employeeId: string;
  userId: string;
  possibleScopes: readonly string[];
  desiredScopes: Set<string>;
}): Promise<{ scope: string; action: "granted" | "revoked" }[]> {
  const existingRows = await db
    .select({ id: aiEmployeeScopes.id, scope: aiEmployeeScopes.scope, status: aiEmployeeScopes.status })
    .from(aiEmployeeScopes)
    .where(
      and(
        eq(aiEmployeeScopes.businessId, businessId),
        eq(aiEmployeeScopes.aiEmployeeId, employeeId),
        eq(aiEmployeeScopes.effect, "allow"),
      ),
    );

  const existingByScope = new Map(existingRows.map((row) => [row.scope, row]));
  const now = new Date();
  const changes: { scope: string; action: "granted" | "revoked" }[] = [];

  for (const scope of possibleScopes) {
    const existing = existingByScope.get(scope);
    const shouldBeActive = desiredScopes.has(scope);

    if (shouldBeActive && (!existing || existing.status !== "active")) {
      if (existing) {
        await db.update(aiEmployeeScopes).set({ status: "active", updatedAt: now }).where(eq(aiEmployeeScopes.id, existing.id));
      } else {
        await db.insert(aiEmployeeScopes).values({
          id: crypto.randomUUID(),
          businessId,
          aiEmployeeId: employeeId,
          scope,
          effect: "allow",
          status: "active",
          grantedByUserId: userId,
          createdAt: now,
          updatedAt: now,
        });
      }
      changes.push({ scope, action: "granted" });
    } else if (!shouldBeActive && existing && existing.status === "active") {
      await db.update(aiEmployeeScopes).set({ status: "revoked", updatedAt: now }).where(eq(aiEmployeeScopes.id, existing.id));
      changes.push({ scope, action: "revoked" });
    }
  }

  return changes;
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
    const requestedChannels: string[] = Array.isArray(body.channels) ? body.channels : [];

    // Never trust a client-supplied tool/channel outside the curated
    // catalog — this is the platform's ceiling, not a business-editable list.
    const desiredToolScopes = new Set(
      requestedToolIds.filter((toolId) => isCustomToolId(toolId)).map((toolId) => customToolScope(toolId)),
    );
    const desiredChannelScopes = new Set(
      requestedChannels
        .filter((channel): channel is ChannelName => (REAL_CUSTOMER_CHANNELS as readonly string[]).includes(channel))
        .map((channel) => customChannelScope(channel)),
    );

    const toolChanges = await reconcileScopes({
      businessId: membership.businessId,
      employeeId,
      userId: user.id,
      possibleScopes: Object.keys(CUSTOM_TOOL_CATALOG).map(customToolScope),
      desiredScopes: desiredToolScopes,
    });

    const channelChanges = await reconcileScopes({
      businessId: membership.businessId,
      employeeId,
      userId: user.id,
      possibleScopes: REAL_CUSTOMER_CHANNELS.map(customChannelScope),
      desiredScopes: desiredChannelScopes,
    });

    const changes = [...toolChanges, ...channelChanges];

    if (changes.length > 0) {
      await createAuditLog({
        businessId: membership.businessId,
        userId: user.id,
        action: "ai_employee.tools_updated",
        resource: "ai_employee",
        resourceId: employeeId,
        description: `Updated tool/channel permissions for a Custom AI employee (${changes.length} change${changes.length === 1 ? "" : "s"}).`,
        metadata: { changes },
      });
    }

    return NextResponse.json({
      success: true,
      grantedToolIds: [...desiredToolScopes].map((scope) => scope.replace(/^tool:/, "")),
      grantedChannels: [...desiredChannelScopes].map((scope) => scope.replace(/^channel:/, "")),
    });
  } catch (error) {
    console.error("Update custom employee tools error:", error);
    return NextResponse.json({ error: "Unable to update tool permissions." }, { status: 500 });
  }
}
