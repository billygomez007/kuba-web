import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { actionApprovals } from "@/db/schema";
import { requireAIEmployeeAction } from "@/lib/ai/security";
import { authorizationErrorResponse, logSecurityEvent, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";

const APPROVAL_DECISIONS = new Set(["approved", "rejected"]);

export async function GET(request: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.MESSAGING_VIEW, request);
    const actions = await db.select().from(actionApprovals).where(eq(actionApprovals.businessId, context.business.id));
    return NextResponse.json({ actions });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to load approvals." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.MESSAGING_MANAGE, request);
    const body = await request.json();
    const channel = typeof body.channel === "string" ? body.channel.trim() : "";
    const recipient = typeof body.recipient === "string" ? body.recipient.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    const employeeId = typeof body.employeeId === "string" ? body.employeeId.trim() || null : null;
    if (!channel || !recipient || !message) {
      return NextResponse.json({ error: "Channel, recipient, and message are required." }, { status: 400 });
    }

    if (employeeId) {
      await requireAIEmployeeAction({
        businessId: context.business.id,
        employeeId,
        action: "external_communication",
      });
    }

    const actionId = crypto.randomUUID();
    const now = new Date();
    await db.insert(actionApprovals).values({
      id: actionId, businessId: context.business.id, employeeId, channel, recipient, message,
      status: "pending", createdAt: now, updatedAt: now,
    });
    await logSecurityEvent({ context, request, action: "action_approval.created", resource: "action_approval", resourceId: actionId, result: "success" });
    return NextResponse.json({ success: true, actionId }, { status: 201 });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to create approval." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.MESSAGING_MANAGE, request);
    const body = await request.json();
    const actionId = typeof body.actionId === "string" ? body.actionId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!actionId || !APPROVAL_DECISIONS.has(status)) {
      return NextResponse.json({ error: "A valid action ID and approval decision are required." }, { status: 400 });
    }

    const updated = await db.update(actionApprovals)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(actionApprovals.id, actionId), eq(actionApprovals.businessId, context.business.id), eq(actionApprovals.status, "pending")))
      .returning({ id: actionApprovals.id });
    if (!updated[0]) {
      await logSecurityEvent({ context, request, action: "action_approval.decision", resource: "action_approval", resourceId: actionId, result: "denied" });
      return NextResponse.json({ error: "Pending approval not found." }, { status: 404 });
    }

    await logSecurityEvent({ context, request, action: `action_approval.${status}`, resource: "action_approval", resourceId: actionId, result: "success" });
    return NextResponse.json({ success: true });
  } catch (error) {
    return authorizationErrorResponse(error) ?? NextResponse.json({ error: "Unable to update approval." }, { status: 500 });
  }
}
